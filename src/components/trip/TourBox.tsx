import type { TourDetails } from "../../lib/types";

export function TourBox({ tourDetails }: { tourDetails: TourDetails }) {
  return (
    <details className="tour-box">
      <summary>{tourDetails.summary}</summary>
      <div className="tour-body">
        <p>{tourDetails.body}</p>
      </div>
    </details>
  );
}
