import React from "react";

export default function StatCard({ big, label }) {
  return (
    <div className="stat tilt">
      <b>{big}</b>
      <span>{label}</span>
    </div>
  );
}
