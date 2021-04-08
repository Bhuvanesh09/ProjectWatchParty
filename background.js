let color = '#3aa757';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ color });
  console.log('Default background color set to %cgreen', `color: ${color}`);
});

(function() {
    self.importScripts("firebase/firebase-app.js", "firebase/firebase-analytics.js");
    console.log(firebase); // should be truthy
})();
