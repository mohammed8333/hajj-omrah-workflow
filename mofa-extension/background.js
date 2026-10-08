/**
 * MOFA AI Background Service Worker
 * يستخدم Chrome DevTools Protocol (CDP) لتوليد ملف PDF عالي الجودة بنقرة واحدة
 * تماماً مثل أمر Page.printToPDF في بايثون
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GENERATE_PDF") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ success: false, error: "No active tab ID found" });
      return false;
    }

    (async () => {
      try {
        await chrome.debugger.attach({ tabId }, "1.3");

        const printOptions = {
          landscape: false,
          displayHeaderFooter: false,
          printBackground: true,
          preferCSSPageSize: true,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        };

        const result = await chrome.debugger.sendCommand(
          { tabId },
          "Page.printToPDF",
          printOptions
        );

        await chrome.debugger.detach({ tabId });

        if (result && result.data) {
          sendResponse({ success: true, base64Pdf: result.data });
        } else {
          sendResponse({ success: false, error: "No PDF data returned from CDP" });
        }
      } catch (err) {
        try {
          await chrome.debugger.detach({ tabId });
        } catch (_) {}
        console.warn("[MOFA AI Background] CDP Page.printToPDF failed:", err);
        sendResponse({ success: false, error: err.message || "Debugger failed" });
      }
    })();

    return true; // إبقاء القناة مفتوحة للرد غير المتزامن
  }
});
