import type { IconMap, SocialLink, Site } from '@/types'

// todo: metadata
export const SITE: Site = {
  title: "kkghrsbsb's note",
  description: '一个以理性与系统思考为核心的技术笔记站，记录学习、实践与反思。',
  href: 'https://kkghrsbsb.com',
  author: 'kkghrsbsb',
  locale: 'zh-CN',
  featuredPostCount: 2,
  postsPerPage: 3,
}

export const NAV_LINKS: SocialLink[] = [
    {
    href: '/',
    label: 'home',
  },
  {
    href: '/blog',
    label: 'Blog',
  },
  {
    href: '/about',
    label: 'About',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/kkghrsbsb',
    label: 'GitHub',
  },
  {
    href: 'https://twitter.com/kkghrsbsb',
    label: 'Twitter',
  },
  {
    href: 'https://www.threads.net/@kkghrsbsb',
    label: 'Threads',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'simple-icons:x',
  Threads: 'simple-icons:threads',
  RSS: 'lucide:rss',
}
