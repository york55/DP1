import { createRoot } from 'react-dom/client'

export function createReactPopup(Component, props) {

  const container =
    document.createElement('div')

  const root =
    createRoot(container)

  root.render(
    <Component {...props} />
  )

  return container
}