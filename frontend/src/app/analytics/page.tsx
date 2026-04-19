import { Suspense } from "react";
import AnalyticsClient from "./AnalyticsClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading analytics...</div>}>
      <AnalyticsClient />
    </Suspense>
  );
}