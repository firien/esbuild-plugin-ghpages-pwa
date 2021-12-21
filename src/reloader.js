// this script will be injected into html files

export default () => {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.addEventListener('message', event => {
    let { message } = JSON.parse(event.data);
    if (message === 'reload') {
      window.location.reload()
    }
  });
}
