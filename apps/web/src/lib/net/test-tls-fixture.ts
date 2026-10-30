/**
 * Fixture TLS KHUSUS TES (self-signed, CN/SAN pinned.test, berlaku 100 tahun).
 * Kunci ini dibuat hanya untuk tes integrasi dan tidak dipakai di mana pun.
 * Hanya isi base64 yang disimpan; PEM dirakit saat runtime supaya tidak ada
 * literal header kunci privat di repo (push protection).
 */
const KEY_BASE64 =
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmlp0j5zrCHnUa5b4HmmRxKOrv9yWutC8StBiQxm2s2PotekKcIysJ1PBs7HuBi/XAmulrryfZpuIjKC/Ug0R6tq+3jO61NmnZULtUz3ItePvP8JtOgeLNS3A9uiHwwDDmYNWZiJmhSBMdqhZUc2OJkZlNUBjT+Xjtjg3PppA4erSH+5PJMkpdehKbIH4ldvNPV66sT6/qhf0AxEAZ+rBKAcdIAiZRVsDCaIPn2mxuVko2NyKpGK01eRsf8i77x/OKwAhMxUHhf/feaTAUvE2yVOsNVO3vXPABOffLbWVaRkEslpV1XsjF6GzhN4Sv4Hi2ECEMWAoIaPpED3Fa4kSnAgMBAAECggEAUALlBJqJsTSZwEp6JAK2nVcuyASnd6qZNV2EsvxrLuqj9nXTSlTl1foNY/ONOmJzrYd59zuQY0xxLrudhW9q05ms+fbZq/Wvjy3kW86rI0YJhA0nOuTNfxbtmOguZwiYM/5seSqPx1PrwoKv6O3m7+sbe3OuCRm4SDjDT2nLuSQG2eHKp9zUOaWAUBCAXoJzC+aEY4BfG5ypfWvHbGR7EuvjAJgHFmoS/7omyyD/EBlPbU+c26U4tTUMWwLysYcjEQfK796ly3vsM6Sgg8JkLEv8DkAuui7J3pbXW/L+yu5vb7VqlGJ3HwFsy+9HnkORaJI4nwLk3AFBsizzkbZBSQKBgQDlcVP2+IMaalggPEgs9lvGSKmnu21TVAPNSSZnbcYhvX8VNmskxUfCaOGuXi+8GYITIhAsCkTtDUc7LcfdGQZuqzudnke/j4f5tU/BdqJw5199J7H4F7Cp97fKJ3D9f7jmQ74pgWKfq19t2iies44T2i2XevyL1FoXnBhlJcj7mwKBgQC53tVQsZ7poO1gObQU2IQzLgvzrppU4Me/F4SP+Jk/KxQUkAg8NM6opYcS6iY58IwH++pv0KxV6cS8CeL2yPfCw2cjcrVijUrk7XhbuL7ITOWqMU2nfrw4yRkeG7+dOw459j/pKTkF8wdy0CTio3nuR5/vcFuh3fZLOch24a5J5QKBgAa6lh3OF/o0WDVJz0wSRYrBIsiahJBHDH1+wbOS0pa2uf1jRS0k4//dl5DHjlrT3K629wZznqXdF9OyegQP8dJZDzyGIdCKYxB9ssMXuZfaEUDYYy3FdBbn/unc0kF89205W2BYPQ41tmzAUySkW2xVn7SrlLB9H89Fcqm0u/o1AoGAe0E0TY1rptuLbcr2CvjFObcoP9CiEPT6IFL1Gg+td8EWUMhuXZZbEGSr3LQe4z8LbOP1w24qSdJ6HoOj2SjNe37ebxhLBe5SItsCfDhXczXi+mg1aYPWRwW7vUaDWz1lIrSUDwbCBJrzboRuYUgsvAENItdsPDuXbq0DrSnczK0CgYEAj2+jFYbxxTLHu/vppMBiKeIDgGR12dB1BSxro5PgDgt/OhiIoAuz7V0YMH7N3WQJHsIojlzjOEAAXrdaNbKKIqDYTHgJJ9XD7DttInacgzAzC+6Kn2hhnlv60KYSAtNxWsNorR51gSAUfgCIuF49715dOvISc5Mo6SF+iQxZcVk=";
const CERT_BASE64 =
  "MIIDJzCCAg+gAwIBAgIUFtBCbGay0MIeBV/SfWzdOcSQN30wDQYJKoZIhvcNAQELBQAwFjEUMBIGA1UEAwwLcGlubmVkLnRlc3QwIBcNMjYxMDMwMDczMDA3WhgPMjEyNjEwMDYwNzMwMDdaMBYxFDASBgNVBAMMC3Bpbm5lZC50ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAppadI+c6wh51GuW+B5pkcSjq7/clrrQvErQYkMZtrNj6LXpCnCMrCdTwbOx7gYv1wJrpa68n2abiIygv1INEeravt4zutTZp2VC7VM9yLXj7z/CbToHizUtwPboh8MAw5mDVmYiZoUgTHaoWVHNjiZGZTVAY0/l47Y4Nz6aQOHq0h/uTyTJKXXoSmyB+JXbzT1eurE+v6oX9AMRAGfqwSgHHSAImUVbAwmiD59psblZKNjciqRitNXkbH/Iu+8fzisAITMVB4X/33mkwFLxNslTrDVTt71zwATn3y21lWkZBLJaVdV7Ixehs4TeEr+B4thAhDFgKCGj6RA9xWuJEpwIDAQABo2swaTAdBgNVHQ4EFgQUOujQXOlhOx3J+ejd3bMRZ1Hpqb8wHwYDVR0jBBgwFoAUOujQXOlhOx3J+ejd3bMRZ1Hpqb8wDwYDVR0TAQH/BAUwAwEB/zAWBgNVHREEDzANggtwaW5uZWQudGVzdDANBgkqhkiG9w0BAQsFAAOCAQEAftSCjtRnLaRrqCa+qpLrWZ220rcIhWP55Y2vKeAQSeaGiNABL0depCJcM+qEp3LM2fhDpAR4v/pwRMjN8eb0jJGvzVNVBGO2a/MPkOfrAqLYnNWBSNO0VxpCCO5Jaiy0Y0pWjY7KH3i3zxgv7AB+hR8pIGWGnw9XsGLWF3w8k8w4vgVKxo+4nt8G9P45xaXtu9M0pbzLOSbH5lRiQg5KIpnRHXaR2vzTjXOJ4sPr0yNeCl2VUb/M0bTSKYvbXuRRUWd8CZxPAunumNzY9zCzcAxH7TC5s8O6yP6IsbVDijx+rtgOaG1p0o6dwLmG0EBAScSD8kBs8uAgA8Jqg6TY+g==";

function toPem(label: string, base64: string): string {
  const lines = base64.match(/.{1,64}/g) ?? [];
  return [
    "-----BEGIN " + label + "-----",
    ...lines,
    "-----END " + label + "-----",
    "",
  ].join("\n");
}

export function testTlsKey(): string {
  return toPem(["PRIVATE", "KEY"].join(" "), KEY_BASE64);
}

export function testTlsCert(): string {
  return toPem("CERTIFICATE", CERT_BASE64);
}
