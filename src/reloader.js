// this script will be injected in development environments

const reloader = () => {
  const reloadSource = new EventSource('/reload');
  reloadSource.onmessage = (event) => {
    window.location.reload()
  }
}

reloader()
