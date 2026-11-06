
const GITHUB_OWNER = 'mamet334';
const GITHUB_REPO = 'mamet-ecosystem';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

export class RepositoryReaderService {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    this.repoTree = null;
    this.treeBuiltAt = null;
  }

  async initialize() {
    console.log(`[RepositoryReaderService] Initializing — backend: ${this.isElectron ? 'Electron' : 'GitHub API'}`);
    this._prefetchTree().catch(() => {});
  }


  async readFile(path) {
    console.log(`[RepositoryReaderService] readFile: ${path}`);

    const cleanPath = path.replace(/^\//, '').replace(/\\/g, '/');

    if (this.isElectron) {
      return this._readFileElectron(cleanPath);
    }
    return this._readFileGitHub(cleanPath);
  }

  async listDirectory(dirPath = '') {
    console.log(`[RepositoryReaderService] listDirectory: ${dirPath || '(root)'}`);
    const cleanPath = dirPath.replace(/^\//, '').replace(/\\/g, '/');

    if (this.isElectron) {
      return this._listDirectoryElectron(cleanPath);
    }
    return this._listDirectoryGitHub(cleanPath);
  }

  async searchFiles(query) {
    console.log(`[RepositoryReaderService] searchFiles: ${query}`);
    const tree = await this._getTree();
    if (!tree) return [];

    const q = query.toLowerCase();
    return tree
      .filter(item => item.type === 'blob' && item.path.toLowerCase().includes(q))
      .map(item => item.path)
      .slice(0, 50);
  }

  async readMultipleFiles(paths) {
    const results = {};
    const chunks = [];
    for (let i = 0; i < paths.length; i += 5) {
      chunks.push(paths.slice(i, i + 5));
    }
    for (const chunk of chunks) {
      const reads = await Promise.allSettled(chunk.map(p => this.readFile(p)));
      reads.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          results[chunk[idx]] = r.value.content;
        }
      });
    }
    return results;
  }

  async getRepoTree() {
    return this._getTree();
  }


  async _readFileGitHub(path) {
    try {
      const headers = this._getGitHubHeaders();
      const url = `${GITHUB_RAW_BASE}/${path}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[RepositoryReaderService] File tidak ditemukan di GitHub: ${path}`);
          return null;
        }
        throw new Error(`GitHub raw fetch gagal: HTTP ${response.status}`);
      }

      const content = await response.text();
      return {
        content,
        path,
        size: content.length,
        backend: 'github-raw',
        url
      };
    } catch (e) {
      console.error(`[RepositoryReaderService] GitHub read error for ${path}:`, e.message);
      return null;
    }
  }

  async _listDirectoryGitHub(dirPath) {
    try {
      const headers = this._getGitHubHeaders();
      const url = `${GITHUB_API_BASE}/contents/${dirPath}?ref=${GITHUB_BRANCH}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.warn(`[RepositoryReaderService] GitHub contents fetch gagal: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size || 0
      }));
    } catch (e) {
      console.error(`[RepositoryReaderService] GitHub list error for ${dirPath}:`, e.message);
      return [];
    }
  }

  async _getTree() {
    const TEN_MINUTES = 10 * 60 * 1000;
    if (this.repoTree && this.treeBuiltAt && (Date.now() - this.treeBuiltAt < TEN_MINUTES)) {
      return this.repoTree;
    }

    try {
      const headers = this._getGitHubHeaders();
      const url = `${GITHUB_API_BASE}/git/trees/${GITHUB_BRANCH}?recursive=1`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.warn(`[RepositoryReaderService] GitHub tree fetch gagal: HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      this.repoTree = data.tree || [];
      this.treeBuiltAt = Date.now();
      console.log(`[RepositoryReaderService] ✅ GitHub tree loaded: ${this.repoTree.length} items`);
      return this.repoTree;
    } catch (e) {
      console.error('[RepositoryReaderService] GitHub tree error:', e.message);
      return null;
    }
  }

  async _prefetchTree() {
    if (!this.isElectron) {
      await this._getTree();
    }
  }

  _getGitHubHeaders() {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    try {
      if (this.serviceManager.has('VaultService')) {
        const vault = this.serviceManager.get('VaultService');
        const token = vault.get?.('github_token') || vault.getSecret?.('github_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (e) {
    }
    return headers;
  }


  async _readFileElectron(path) {
    try {
      const content = await window.electronAPI.readFile(path);
      if (content === null || content === undefined) return null;
      return {
        content,
        path,
        size: content.length,
        backend: 'electron'
      };
    } catch (e) {
      console.error(`[RepositoryReaderService] Electron read error for ${path}:`, e.message);
      return null;
    }
  }

async _listDirectoryElectron(dirPath) {
    try {
      const entries = await window.electronAPI.listFiles(dirPath || '.');
      if (!Array.isArray(entries)) return [];
      return entries.map(entry => {
        if (typeof entry === 'string') {
          const name = entry.split('/').pop() || entry;
          return {
            name,
            path: dirPath ? `${dirPath}/${name}` : name,
            type: 'unknown',
            size: 0
          };
        }
        return {
          name: entry.name,
          path: dirPath ? `${dirPath}/${entry.name}` : entry.name,
          type: entry.type === 'dir' ? 'dir' : 'file',
          size: entry.size || 0
        };
      });
    } catch (e) {
      console.error(`[RepositoryReaderService] Electron list error for ${dirPath}:`, e.message);
      return [];
    }
  }
}
