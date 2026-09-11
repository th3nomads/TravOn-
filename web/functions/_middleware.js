export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<link rel="stylesheet" href="/desktop-compact.css?v=20260911-panorama1">', { html: true });
      }
    })
    .on("body", {
      element(element) {
        element.append('<script src="/shared-remove.js?v=20260910-remove-shared1"></script><script src="/itinerary-label.js?v=20260910-singular1"></script><script src="/capitalize-itinerary.js?v=20260910-cap1"></script><script src="/admin-stats.js?v=20260910-admin1"></script><script src="/desktop-panorama.js?v=20260911-panorama1"></script>', { html: true });
      }
    })
    .transform(response);
}
