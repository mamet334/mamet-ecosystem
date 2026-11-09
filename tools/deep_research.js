export default {
  name: 'deep_research',
  description: 'Melakukan riset mendalam multi-langkah dengan sintesis',
  category: 'research',
  async execute(params, context) {
    return { message: 'Deep research tool ready', topic: params.topic };
  }
};
