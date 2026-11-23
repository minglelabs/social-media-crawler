// Runs in the page's own JS world (Threads only): the content script cannot see React's data, and Threads
// plays videos from blob: streams. The player props carry the plain progressive mp4 (video + audio), so on
// request we look it up for the marked <video> and hand it back through a data attribute.
document.addEventListener('smc-resolve-video', () => {
  for (const video of document.querySelectorAll('video[data-smc-want]')) {
    video.removeAttribute('data-smc-want');
    const key = Object.keys(video).find((k) => k.startsWith('__reactFiber'));
    let fiber = key ? video[key] : null;
    for (let depth = 0; fiber && depth < 30; depth++, fiber = fiber.return) {
      const impls = fiber.memoizedProps?.implementations;
      if (!Array.isArray(impls)) continue;
      const progressive = impls.find((i) => i?.data?.hdSrc || i?.data?.sdSrc);
      if (progressive) video.setAttribute('data-smc-src', progressive.data.hdSrc || progressive.data.sdSrc);
      break;
    }
  }
});
