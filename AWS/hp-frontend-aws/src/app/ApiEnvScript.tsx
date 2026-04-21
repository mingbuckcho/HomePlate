/**
 * Server-only: inject API base URL from runtime env (API_BASE_URL) into window.
 * 쿠버네티스 Secret 변경만으로 재배포(재빌드 불필요).
 */
export default function ApiEnvScript() {
  const apiBaseUrl = process.env.API_BASE_URL || "https://homeplate.site/api";

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__API_BASE_URL__=${JSON.stringify(apiBaseUrl)};`,
      }}
      data-api-env
    />
  );
}
