/**
 * Server-only: inject RUM env from runtime env (RUM_*) into window.
 * 쿠버네티스 Secret 변경만으로 재배포(재빌드 불필요). NEXT_PUBLIC_ 제거.
 */
export default function RumEnvScript() {
  const enabled =
    String(process.env.RUM_ENABLED ?? "")
      .toLowerCase()
      .trim() === "true";
  const rumConfig = {
    endpoint: process.env.RUM_ENDPOINT || "https://homeplate.site/collect",
    enabled,
    appName: process.env.RUM_APP_NAME || "homeplate-web",
    env: process.env.RUM_ENV || "prod",
    cluster: process.env.RUM_CLUSTER || "hp-onprem",
    sampleRate: parseFloat(process.env.RUM_SAMPLE_RATE || "1.0"),
    otlpMetricsEndpoint: process.env.RUM_OTLP_METRICS_ENDPOINT || "",
  };

  const script = `window.__RUM_ENDPOINT__=${JSON.stringify(rumConfig.endpoint)};window.__RUM_ENABLED__=${JSON.stringify(rumConfig.enabled)};window.__RUM_APP_NAME__=${JSON.stringify(rumConfig.appName)};window.__RUM_ENV__=${JSON.stringify(rumConfig.env)};window.__RUM_CLUSTER__=${JSON.stringify(rumConfig.cluster)};window.__RUM_SAMPLE_RATE__=${rumConfig.sampleRate};window.__RUM_OTLP_METRICS_ENDPOINT__=${JSON.stringify(rumConfig.otlpMetricsEndpoint)};`;
  return <script dangerouslySetInnerHTML={{ __html: script }} data-rum-env />;
}
