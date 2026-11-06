import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const teksSimpul = (n) => (n?.type === 'text' ? n.value : (n?.children || []).map(teksSimpul).join(''));

export function KotakKode({ isi, label, perintah = '', tinggiMaks = false }) {
  const [hasilSalin, setHasilSalin] = useState(null);
  const salin = () => {
    const tampilkan = (h) => { setHasilSalin(h); setTimeout(() => setHasilSalin(null), 2000); };
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(isi))
      .then(() => tampilkan('Tersalin ✓'), (err) => {
        console.warn('[TeksMarkdown] Gagal menyalin kode:', err);
        tampilkan('Gagal — blok & salin manual');
      });
  };
  return (
    <div className="my-3 min-w-0 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 px-1 text-label-mono text-on-surface-variant">
        <span className="min-w-0 truncate">
          <span className="uppercase tracking-widest">{label}</span>
          {perintah && <span className="normal-case tracking-normal"> · {perintah}</span>}
        </span>
        <button type="button" onClick={salin} className="shrink-0 uppercase tracking-widest hover:text-primary transition-colors" title="Salin kode">
          {hasilSalin || 'Salin'}
        </button>
      </div>
      <pre className={`w-full bg-surface-container-lowest border border-outline-variant px-5 py-4 rounded-lg overflow-x-auto custom-scrollbar ${tinggiMaks ? 'max-h-[24rem] overflow-y-auto' : ''}`}>
        <code className="block whitespace-pre font-mono text-[14px] leading-[1.6] [tab-size:2]">{isi}</code>
      </pre>
    </div>
  );
}

function BlokKode({ node }) {
  const kode = node?.children?.find((c) => c.tagName === 'code');
  const kelas = [].concat(kode?.properties?.className || []).join(' ');
  const bahasa = (kelas.match(/language-([\w+#.-]+)/) || [])[1] || '';
  return <KotakKode isi={teksSimpul(kode || node).replace(/\n$/, '')} label={bahasa || 'kode'} />;
}

const KOMPONEN = {
  p: ({ node, ...p }) => <p className="my-3 first:mt-0 last:mb-0" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-on-surface-strong" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => <a className="text-primary underline underline-offset-2 hover:decoration-2" target="_blank" rel="noopener noreferrer" {...p} />,
  ul: ({ node, ...p }) => <ul className="my-3 pl-6 list-disc space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-3 pl-6 list-decimal space-y-1" {...p} />,
  li: ({ node, ...p }) => <li className="pl-1" {...p} />,
  h1: ({ node, ...p }) => <h1 className="mt-5 mb-2 first:mt-0 text-[20px] leading-8 font-semibold text-on-surface-strong" {...p} />,
  h2: ({ node, ...p }) => <h2 className="mt-5 mb-2 first:mt-0 text-[18px] leading-7 font-semibold text-on-surface-strong" {...p} />,
  h3: ({ node, ...p }) => <h3 className="mt-4 mb-1.5 first:mt-0 text-[16px] leading-7 font-semibold text-on-surface-strong" {...p} />,
  h4: ({ node, ...p }) => <h4 className="mt-4 mb-1.5 first:mt-0 text-[16px] leading-7 font-semibold opacity-80" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="my-3 pl-4 border-l-2 border-outline-variant opacity-80" {...p} />,
  hr: ({ node, ...p }) => <hr className="my-5 border-outline-variant" {...p} />,
  code: ({ node, className, children, ...p }) => {
    const blok = /language-/.test(className || '') || String(children).includes('\n');
    return blok
      ? <code className={className} {...p}>{children}</code>
      : <code className="px-1.5 py-0.5 rounded-md bg-surface-container-high font-mono text-[14px] text-primary-fixed" {...p}>{children}</code>;
  },
  pre: ({ node }) => <BlokKode node={node} />,
  table: ({ node, ...p }) => (
    <div className="my-3 overflow-x-auto custom-scrollbar">
      <table className="min-w-full border-collapse text-[14px] leading-6" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => <th className="px-3 py-2 text-left font-semibold border-b border-outline align-bottom" {...p} />,
  td: ({ node, ...p }) => <td className="px-3 py-2 border-b border-outline-variant align-top" {...p} />,
};

const PLUGIN = [remarkGfm];

function TeksMarkdown({ teks }) {
  if (!teks) return null;
  return (
    <div className="leading-7 break-words">
      <Markdown remarkPlugins={PLUGIN} components={KOMPONEN}>{teks}</Markdown>
    </div>
  );
}

export default React.memo(TeksMarkdown);
