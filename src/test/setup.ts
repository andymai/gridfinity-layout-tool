import '@testing-library/jest-dom'

// Mock pointer capture methods not implemented in jsdom
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.hasPointerCapture = () => false
