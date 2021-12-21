export default (dir) => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`/${dir}/service.js`, {scope: `/${dir}/`}).then((registration) => {
      const refreshPage = (worker) => {
        if (worker.state != 'activated') {
          worker.postMessage({action: 'skipWaiting'});
        }
        window.location.reload();
      }
      if (registration.waiting) {
        refreshPage(registration.waiting);
      }
      registration.addEventListener('updatefound', () => {
        let newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            refreshPage(newWorker);
          }
        });
      });
    });
  }
}
