import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';

import '../styles/theme.css';

/**
 * Server shell. Everything that touches wishes or the profile is client-side
 * (docs/tech-stack.md §3), so this layout stays data-free on purpose.
 *
 * Geist comes from the `geist` package rather than `next/font/google`: the
 * files are shipped with the dependency, so there is no font fetch at build
 * time. Inter remains in the stack as the documented substitute
 * (see `--font-sans` in styles/theme.css).
 */

export const metadata: Metadata = {
	title: 'TinyWishlist',
	description: 'Список бажань, яким приємно поділитися'
};

export const viewport: Viewport = {
	themeColor: '#f5f5f5',
	width: 'device-width',
	initialScale: 1
};

export default function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang='uk' className={GeistSans.variable}>
			<body>{children}</body>
		</html>
	);
}
