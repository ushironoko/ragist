import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Gistdex",
  description: "A semantic search and indexing tool for developers",
  base: '/',
  lastUpdated: true,
  cleanUrls: true,
  
  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'Gistdex | Semantic Search Tool' }],
    ['meta', { property: 'og:site_name', content: 'Gistdex' }],
    ['meta', { property: 'og:description', content: 'A powerful CLI tool for indexing and searching content using vector databases' }]
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'CLI Reference', link: '/reference/cli' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          collapsed: false,
          items: [
            { text: 'What is Gistdex?', link: '/guide/what-is-gistdex' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        },
        {
          text: 'Core Concepts',
          collapsed: false,
          items: [
            { text: 'How It Works', link: '/guide/how-it-works' }
          ]
        },
        {
          text: 'Configuration',
          collapsed: false,
          items: [
            { text: 'Configuration Overview', link: '/guide/configuration' }
          ]
        },
        {
          text: 'Usage',
          collapsed: false,
          items: [
            { text: 'Indexing Content', link: '/guide/indexing' },
            { text: 'Searching', link: '/guide/searching' }
          ]
        },
        {
          text: 'Integrations',
          collapsed: false,
          items: [
            { text: 'Claude Code (MCP)', link: '/guide/mcp' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'CLI Commands', link: '/reference/cli' },
            { text: 'Troubleshooting', link: '/reference/troubleshooting' }
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ushironoko/gistdex' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@ushironoko/gistdex' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present ushironoko'
    },

    editLink: {
      pattern: 'https://github.com/ushironoko/gistdex/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: 'On this page'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  }
})