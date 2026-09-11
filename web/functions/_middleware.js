export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("body", {
      element(element) {
        element.append('<script src="/shared-remove.js?v=20260910-remove-shared1"></script>', { html: true });
      }
    })
    .transform(response);
}
