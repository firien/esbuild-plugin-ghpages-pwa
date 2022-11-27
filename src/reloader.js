// this script will be injected in development environments

const reloader = () => {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener('message', event => {
    let { message } = JSON.parse(event.data);
    if (message === 'reload') {
      window.location.reload()
    }
  });
}

reloader()
