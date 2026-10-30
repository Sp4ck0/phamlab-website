import type { TourDetails } from "../../lib/types";
import { Linkify } from "./Linkify";

export function TourBox({ tourDetails }: { tourDetails: TourDetails }) {
  return (
    <details className="tour-box">
      <summary><Linkify text={tourDetails.summary} /></summary>
      <div className="tour-body">
        <p><Linkify text={tourDetails.body} /></p>
      </div>
    </details>
  );
}
