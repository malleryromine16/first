module.exports = {
  // Tags are inherited by all posts.
  tags: ['pathItem', 'lighthouse-performance'],
  path: {
    // Slug is used by landing pages like / and /learn to link to this path.
    // Because it affects urls, the slug should never be translated.
    slug: 'lighthouse-performance',
    cover: '/images/collections/lighthouse.png',
    title: 'Performance audits',
    description:
      'How long does your app take to show content and become useable?',
    overview: `Lorem ipsum dolor set amet...`,
    topics: [
      {
        title: 'Metrics',
        pathItems: ['first-contentful-paint'],
      },
      {
        title: 'Opportunities',
        pathItems: [],
      },
      {
        title: 'Diagnostics',
        pathItems: [],
      },
    ],
  },
};
