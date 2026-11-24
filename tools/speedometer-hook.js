// speedometer-hook.js - post Speedometer results to the local receiver.
//
// Add this as the last <script> in a *locally served* copy of Speedometer 3.1 (served from
// the same http origin as the page, so no mixed-content block, and same-origin for the POST).
//
//   <script src="./speedometer-hook.js"></script>
//
// It hooks the result callback that already exists on the benchmark client, so the JSON is
// the same object the "Download JSON" button would write, including per-test Sync/Async.

(function () {
  var endpoint = new URL("/results", location.href).href;
  var attempts = 0;

  function send(results) {
    var body = JSON.stringify(results);
    try {
      fetch(endpoint, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain" },
        body: body,
      }).catch(function () {});
    } catch (error) {
      // keep the benchmark result visible even if the receiver is gone
      console.log("result post failed: " + error);
    }
  }

  function attach() {
    var client = window.benchmarkClient;
    if (!client) {
      if (attempts++ < 200) setTimeout(attach, 100);
      return;
    }
    if (client.__dxHooked) return;
    client.__dxHooked = true;

    var original = client.didFinishLastIteration;
    if (typeof original === "function") {
      client.didFinishLastIteration = function () {
        var result = original.apply(this, arguments);
        try { send(this._measuredValuesList); } catch (error) {}
        return result;
      };
      return;
    }

    // Fallback: poll for a finished result list.
    var timer = setInterval(function () {
      if (client._hasResults && client._measuredValuesList && client._measuredValuesList.length) {
        clearInterval(timer);
        send(client._measuredValuesList);
      }
    }, 500);
  }

  if (document.readyState === "complete") attach();
  else window.addEventListener("load", attach);
})();
