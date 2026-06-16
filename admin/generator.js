const LANDSCAPE_WIDTHS = [500, 800, 1080, 1600, 2000, 2600, 3200];
const PORTRAIT_WIDTHS = [500, 800];

export function splitLines(value = "") {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function slugify(title = "") {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitExtension(filePath = "") {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot <= 0) {
    return null;
  }

  return {
    base: filePath.slice(0, lastDot),
    ext: filePath.slice(lastDot),
  };
}

function sanitizePathname(pathname, label) {
  const normalizedPath = String(pathname).replaceAll("\\", "/").trim();
  if (!normalizedPath) {
    throw new Error(`${label} is required`);
  }

  return normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sanitizeImagePath(filePath, label) {
  const value = String(filePath ?? "").trim();
  const match = value.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const pathname = match?.[1] ?? "";
  const search = match?.[2] ?? "";
  const hash = match?.[3] ?? "";
  const sanitizedPathname = sanitizePathname(pathname, label);
  const sanitizedSearch = search ? encodeURI(search) : "";
  const sanitizedHash = hash ? encodeURI(hash) : "";
  const sanitizedPath = `${sanitizedPathname}${sanitizedSearch}${sanitizedHash}`;
  const parts = splitExtension(sanitizedPathname);

  if (!parts) {
    throw new Error(`${label} must include a file extension`);
  }

  return {
    path: sanitizedPath,
    base: parts.base,
    ext: parts.ext,
  };
}

function ensurePath(filePath, label) {
  return sanitizeImagePath(filePath, label);
}

export function buildSrcsetVariants(filePath, widths, finalWidth) {
  const { path } = ensurePath(filePath, "Image path");
  return path;
}

export function buildLandscapeItem(filePath) {
  const { path } = ensurePath(filePath, "Landscape photo path");
  const srcset = buildSrcsetVariants(filePath, LANDSCAPE_WIDTHS, "3936w");

  return `<div role="listitem" class="still_item w-dyn-item w-dyn-repeater-item"><div class="work-image-wrap"><img loading="lazy" height="Auto" alt="" src="../${path}" sizes="(max-width: 479px) 92vw, 95vw" srcset="../${srcset}" class="work-image"></div></div>`;
}

export function buildPortraitItem(filePath) {
  const { path } = ensurePath(filePath, "Portrait photo path");
  const srcset = buildSrcsetVariants(filePath, PORTRAIT_WIDTHS, "1005w");

  return `<div role="listitem" class="collection-item w-dyn-item w-dyn-repeater-item w-col w-col-6"><a href="#" class="w-inline-block w-lightbox" aria-label="open lightbox" aria-haspopup="dialog"><img src="../${path}" loading="lazy" alt="" sizes="(max-width: 479px) 40vw, (max-width: 767px) 44vw, (max-width: 991px) 46vw, 453px" srcset="../${srcset}"><script type="application/json" class="w-json">{"items":[{"url":"../${path}","type":"image"}],"group":"PeopleOfItaly"}</script></a></div>`;
}

export function buildSnippetHtml(
  template,
  { title, subtitle, slug, coverPhotoPath, coverPhotoAlt = title },
) {
  const { path } = ensurePath(coverPhotoPath, "Cover photo path");
  const escapedTitle = escapeHtml(title);
  const escapedSubtitle = escapeHtml(subtitle);
  const escapedCoverPhotoAlt = escapeHtml(coverPhotoAlt);
  let rendered = template
    .replaceAll("{title}", escapedTitle)
    .replaceAll("{subtitle}", escapedSubtitle)
    .replaceAll("{urlSlug}", slug)
    .replaceAll("{coverPhotoAlt}", escapedCoverPhotoAlt)
    .replaceAll("{imageUrl}", path)
    .replaceAll("{imageSuffix}", "");

  return rendered.replace(/srcset="[\s\S]*?"/g, `srcset="${path}"`);
}

function stripSectionByClass(html, className) {
  const pattern = new RegExp(
    `<section class="${className}">[\\s\\S]*?<\\/section>\\s*`,
    "m",
  );
  return html.replace(pattern, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildWorkPageHtml(
  template,
  {
    title,
    subtitle,
    coverPhotoPath,
    landscapePhotos,
    portraitPhotos,
    caption = "",
  },
) {
  const { path } = ensurePath(coverPhotoPath, "Cover photo path");
  const landscapeGalleryPhotos = landscapePhotos.filter(
    (photoPath) => photoPath !== coverPhotoPath,
  );
  const landscapeHtml = landscapeGalleryPhotos
    .map(buildLandscapeItem)
    .join("\n");
  const portraitHtml = portraitPhotos.map(buildPortraitItem).join("\n");
  const escapedTitle = escapeHtml(title);
  const escapedSubtitle = escapeHtml(subtitle);
  const escapedCaption = escapeHtml(caption);

  let rendered = template
    .replaceAll("{title}", escapedTitle)
    .replaceAll("{subtitle}", escapedSubtitle)
    .replaceAll("{coverPhotoUrl}", `../${path}`)
    .replaceAll("{imageSuffixLandscape}", "")
    .replace(
      'alt="Woman in Cartagena Colombia with the Palaqueras."',
      `alt="${escapedTitle}"`,
    )
    .replaceAll("{nextWorkTitle}", "")
    .replaceAll("{nextWorkUrlSlug}", "")
    .replaceAll("{nextWorkCoverImageUrl}", "")
    .replaceAll("{description}", escapedCaption)
    .replace("{insertLandscapePhotosHere}", landscapeHtml)
    .replace("{insertPortraitImagesHere}", portraitHtml);

  rendered = rendered.replace(/srcset="[\s\S]*?"/, `srcset="../${path}"`);

  return stripSectionByClass(rendered, "section_work-next");
}
