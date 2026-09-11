(() => {
  const capitalize = text => text
    .replace(/\bitineraries\b/g, "Itineraries")
    .replace(/\bitinerary\b/g, "Itinerary");

  function updateText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) continue;
      const updated = capitalize(node.nodeValue || "");
      if (updated !== node.nodeValue) node.nodeValue = updated;
    }
  }

  updateText();
  new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const updated = capitalize(node.nodeValue || "");
          if (updated !== node.nodeValue) node.nodeValue = updated;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          updateText(node);
        }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
