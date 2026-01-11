import { BrowserRouter, Routes, Route } from "react-router-dom"

import { Dashboard } from "./pages/Dashboard.js"

export function App(): React.ReactNode {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
            </Routes>
        </BrowserRouter>
    )
}
