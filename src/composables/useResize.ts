import { ref } from 'vue'

export function useResize(initialHeight = 320) {
  const bottomHeight = ref(initialHeight)

  function startVerticalResize(e: MouseEvent) {
    const startY = e.clientY
    const startHeight = bottomHeight.value

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      bottomHeight.value = Math.max(150, Math.min(600, startHeight + delta))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return { bottomHeight, startVerticalResize }
}
