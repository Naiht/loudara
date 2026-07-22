import { playerStore } from '@stores';
import { config } from '@utils';


// Generates both channel and stream thumbnails


export function generateImageUrl(
  id: string,
  res: string,
  music?: boolean
) {
  if (!id) return '';
  if (/^https?:\/\//i.test(id)) return id;

  let prefix = '';
  if (id.startsWith('/')) {
    prefix = `https://yt3.googleusercontent.com${id}=s${res === 'mq' ? '180' : res || '360'}-c-k-c0x00ffffff-no-rj`;
  }
  else {
    const quality = music ? 'hq' : res;
    prefix = `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;
  }
  return prefix;
}

export function createFallbackArtworkUrl(label = '') {
  const initial = (label.trim().charAt(0) || 'L').toUpperCase();
  const safeInitial = initial.replace(/[&<>"']/g, '') || 'L';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
      <defs>
        <linearGradient id="loudara-artwork-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5b3a86" />
          <stop offset="100%" stop-color="#241532" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="42" fill="url(#loudara-artwork-gradient)" />
      <circle cx="160" cy="160" r="94" fill="rgba(255,255,255,0.08)" />
      <text
        x="160"
        y="186"
        fill="#f4eaff"
        font-family="Quicksand, Arial, sans-serif"
        font-size="116"
        font-weight="700"
        text-anchor="middle"
      >${safeInitial}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}



export function getThumbIdFromLink(url: string) {
  if (!url) return '';

  if (url.startsWith('/vi_webp'))
    url = url.slice(9, 20);

  // for featured playlists
  if (url.startsWith('/') || url.length === 11) return url;
  // simplify url 
  const l = new URL(url);
  const p = l.pathname;

  return (
    l.search.includes('ytimg') ||
    l.hostname === 'i.ytimg.com'
  ) ?
    p.split('/')[2] :
    p.split('=')[0];
}

const style = document.documentElement.style;
const cssVar = style.setProperty.bind(style);
const tabColor = <HTMLMetaElement>document.head.children.namedItem('theme-color');
const systemDark = matchMedia('(prefers-color-scheme:dark)');


function accentDarkener(r: number, g: number, b: number) {

  let min = Math.min(r, g, b);

  if ((r + g + b) / min > 14) {
    r = Math.floor(r / 3);
    g = Math.floor(g / 3);
    b = Math.floor(b / 3);
    min = Math.floor(min / 3);
  }
  return `rgb(${r - min}, ${g - min},${b - min})`;

}


const palette = {
  light: {
    bg: '#fff',
    text: '#000',
    multiplier: '1.1',
  },
  dark: {
    bg: '#000',
    text: '#fff',
    multiplier: '0.9'
  }
};


function colorInjector(colorArray: number[]) {
  const autoDark = systemDark.matches;
  Promise.resolve()
    .then(() => {
      const { theme } = config;
      const scheme = theme === 'auto' ?
        autoDark ? 'dark' : 'light' : theme;

      const [r, g, b] = colorArray;

      if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10)
        cssVar('--chroma', '0');
      else
        cssVar('--chroma', '1');

      cssVar('--trueBg', scheme === 'light' ? 'var(--scheme)' : 'var(--bg)');

      cssVar('--source', accentDarkener(r, g, b));
      cssVar('--bg', palette[scheme].bg);
      cssVar('--schemeMultiplier', palette[scheme].multiplier);
      cssVar('--text', palette[scheme].text);
      tabColor.content = palette[scheme].bg;
    });
}



export function themer() {
  const initColor = '220, 220, 220';
  const { stream } = playerStore;
  const { loadImage } = config;
  if (loadImage && stream.id)
    import('../modules/extractColorFromImage')
      .then(mod => mod.default)
      .then(e => e(
        generateImageUrl(
          stream.img || stream.id,
          'mq',
          stream.author?.endsWith(' - Topic')
        ),
        true
      ))
      .then(colorInjector);
  else
    colorInjector(
      initColor
        .split(',')
        .map(s => parseInt(s))
    );

}

systemDark.addEventListener('change', themer);

export { cssVar };
