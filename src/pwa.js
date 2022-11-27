// this script will be injected in production environments

const pwa = () => {
  if ('serviceWorker' in navigator) {
    let scope = window.location.pathname
    navigator.serviceWorker.register(`${scope}service.js`, { scope }).then((registration) => {
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

pwa();
