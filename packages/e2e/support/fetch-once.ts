/**
 * The stand's servers (the local Worker, the fake Telegram) close a kept-alive connection that
 * waited a few seconds (a spec's `runSql`, a page's load), and Node may send the next request on it
 * just then: "other side closed" before the request was read. That one case is sent again on a new
 * connection; any answer, or any other error, is not.
 */
export async function fetchOnce(url: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init)
    } catch (error) {
        const code = (error as { cause?: { code?: string } }).cause?.code
        if (code !== "UND_ERR_SOCKET") {
            throw error
        }
        return fetch(url, init)
    }
}
