import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders title and framework chips', () => {
    render(<App />)
    expect(screen.getByText('project03frontend')).toBeInTheDocument()
    expect(screen.getByText('Vite')).toBeInTheDocument()
    expect(screen.getByText('Vitest')).toBeInTheDocument()
    expect(screen.getByText('Tailwind CSS')).toBeInTheDocument()
    expect(screen.getByText('Material UI')).toBeInTheDocument()
  })

  it('increments counter on button click', () => {
    render(<App />)
    const button = screen.getByTestId('counter-button')
    expect(button).toHaveTextContent('Count is 0')
    fireEvent.click(button)
    expect(button).toHaveTextContent('Count is 1')
  })
})
