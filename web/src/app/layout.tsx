import type {Metadata, Viewport} from 'next'
import {Nunito_Sans} from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

// Mini Moniker — the wedding site's handwritten display face
const customFont = localFont({
  src: [
    {path: '../../public/fonts/mini-moniker-regular.woff2', weight: '400', style: 'normal'},
    {path: '../../public/fonts/mini-moniker-regular.woff', weight: '400', style: 'normal'},
    {path: '../../public/fonts/mini-moniker-regular.ttf', weight: '400', style: 'normal'},
  ],
  display: 'swap',
  variable: '--font-custom',
})

const bodyFont = Nunito_Sans({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-var',
})

export const metadata: Metadata = {
  title: 'Split the G — Serine & Eóin',
  description: 'The official Split the G wedding championship',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${customFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
