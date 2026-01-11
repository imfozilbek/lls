import { BrowserRouter, Routes, Route } from "react-router-dom"

import { Home } from "./screens/Home.js"

export function App(): React.ReactNode {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
            </Routes>
        </BrowserRouter>
    )
}
