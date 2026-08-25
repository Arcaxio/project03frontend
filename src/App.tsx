import { useState } from 'react'
import { Button, Card, CardContent, Typography, Container, Box, Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Container maxWidth="md" className="py-10">
      <Box className="flex flex-col items-center gap-6 text-center">
        <Typography variant="h3" component="h1" className="font-bold text-slate-800">
          project03frontend
        </Typography>
        <Typography variant="subtitle1" className="text-slate-600">
          Vite + React + Vitest + Tailwind CSS + Material UI
        </Typography>

        <Box className="flex flex-wrap justify-center gap-2 my-4">
          <Chip icon={<CheckCircleIcon />} label="Vite" color="primary" />
          <Chip icon={<CheckCircleIcon />} label="Vitest" color="secondary" />
          <Chip icon={<CheckCircleIcon />} label="Tailwind CSS" color="success" />
          <Chip icon={<CheckCircleIcon />} label="Material UI" color="info" />
        </Box>

        <Card variant="outlined" className="w-full max-w-sm shadow-md">
          <CardContent className="flex flex-col items-center p-6 space-y-4">
            <Typography variant="h6" className="text-gray-700">
              Interactive Test Component
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setCount((c) => c + 1)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="counter-button"
            >
              Count is {count}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}

export default App
