/**
 * The local stand's stand-in for Telegram Login's signing key: the fake Telegram publishes its
 * public half (JWKS), the browser stub signs `id_token`s with it. A test-only key, never used
 * anywhere real. secret-scan: fake
 */
export const STAND_LOGIN_KID = "stand-oidc-1"

export const STAND_LOGIN_PRIVATE_JWK = {
    kty: "RSA", // secret-scan: fake
    n: "rdag6CqficecSNEgkUKfIuYZi9LNkjzMXfgSH1q1kcpuC1q7j-XZubyMDLkR2rZRwmdRQyyI5T6qZONBndXDNrUG3irQqEfSJmN60iK1SX7qJ9L3oqKttJ6fZo3c9QmF-jyYVMqwVaglL1oQ-04bDCtC23p9zSIeRQO5RpU572h7cf_OcJ7WO9wGu6baOqfq82dRAZ-T_WrHD6zRo5eS5PKhL3dY7JjLj_tLXPm_DPm-4Y-c79eD6nDy3giD7N-PmJtqxvW64tBJee1Phcve7J4a-KZtws7NOmLcHrZ6yD5IIpYSUQvmlsFgggV7t0wXFU_3ZQk1PAKKNyn1p0CR5w", // secret-scan: fake
    e: "AQAB", // secret-scan: fake
    d: "P88gkRfUJ8bVXwUkZy2FLFI53lEqlBstCPEd9dReAX3ElvZfEprUKJFE9waXvyhdKnayJW4bccpm0VF5rG3ikhowwywEG0EBqoWpd6i10px7ZtLRgykjicEP0Z0RFgDA5PGJGNatk0N9Irx0r0okM3tNtzJnKvzzD3Imd_oeofmkk1CRdAUCy8xGOk03Nr4FRttvjgK0kT3TW6taVndxZ9070cjO-FZabpQ54Mk6TiWXe4L1zymc1kFr6kOJVXNgMS1JW12jX_BZN6_26fb3dAkDJYVdxmZb2hlJHD8YzSDWJtaCph-bLVTk5ar0YbMj3KdaZ3_ALo-CQI3e7SScgQ", // secret-scan: fake
    p: "5xAyAQmzUjhpGlc-gWogjl6T3p_Wv2ywQzzlE620FkmH87s2Y2F0_J7_a5kTYIkzFOqfxxusPCCaYP8Vc6lDvZ8AuJsGVGqHW5lgcVl7hEshZF_9pCkx87BVHWVV2V7mmA5ZYfenqxjz01ZMj6Fkq4d64GzHQnKkZR0yCGl2_e8", // secret-scan: fake
    q: "wJltYQ_X8oJ60cKddHDzsgEx4MlIwqUiq7xRgtuQJCjXA8qH9BWDITbPANRMPhXIehtvAy7X-eQ_mlhbfEodKjYTpTllqm7hZKPAY6TNURBT23mqMyCB1o4AFt1jIX6GDSJ9deXBL4UfrsWP81uMm3yvo_cK9GwQPPBAS_bVI4k", // secret-scan: fake
    dp: "t8JRgjHMwt7J94Da3OEh8xeUUcCccLBnnZGYPQYv6mmgDV4d6vtepmlsiI28s1FppoDRgO-pEkh7fhhfXxSGIw-I60eeyRPPgjGAWaToblWxwLn2Zc-9QihCCJbGp5CpotQGkbr7RT8a6j__s1qPTTr5pfHcpiO2ShPl7nqxf1E", // secret-scan: fake
    dq: "mQOMDbgLpcSaFTpb4921Dq-6U882ukV-FRipXaBYlRHJOV7XwkixBFtJ_GuuIwklXDWdbdbyibsX-OTH0igDobySwQqnxc8PzOf3-nI9GHEzXkP7v2DNJotscL30evDNSXQkXt1pLPrDoBOfeQU74XAfDtI_Zs7P28o4GuIAlZk", // secret-scan: fake
    qi: "u2N9qxmQKYjUqiMxScWarruOiSUXugmBe1aAFyqqTmW0A4i4qUOqGGq3Az8u2bXS8P7pZRY35Opuem1SQ_3I0rB7LTKYlGT6nDyhPKEerdSpU2-XzGGpsyibA80rZdarHvnxLOyaClF-4sWUpPwVrOjw0ZCh9ylZLr-ELCly654", // secret-scan: fake
}

/** What the fake Telegram publishes at `/.well-known/jwks.json`. */
export const STAND_LOGIN_PUBLIC_JWK = {
    kty: STAND_LOGIN_PRIVATE_JWK.kty,
    n: STAND_LOGIN_PRIVATE_JWK.n,
    e: STAND_LOGIN_PRIVATE_JWK.e,
    alg: "RS256",
    kid: STAND_LOGIN_KID,
    use: "sig",
}
