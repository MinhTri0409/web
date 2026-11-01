"use client";

import Image from "next/image";
import { useState } from "react";

const partners = [
  { id: "hoa-sen", name: "Hoa Sen Group", image: "/images/hoa-sen-group.png" },
  { id: "hitc", name: "Cao đẳng Công thương Thành phố Hồ Chí Minh", image: "/images/hitc.png" },
  { id: "real-madrid", name: "Real Madrid", image: "/images/real-madrid.png" },
];

export default function LandingClientLogos() {
  const [center, setCenter] = useState("hitc");
  const centerIndex = partners.findIndex((partner) => partner.id === center);
  const ordered = [-1, 0, 1].map((offset) => partners[(centerIndex + offset + partners.length) % partners.length]);

  return (
    <>
      <div className="about-customer-logos" aria-live="polite">
        {ordered.map((partner, index) => (
          <div className={`about-customer-logo${index === 1 ? " about-customer-logo-featured" : ""}`} key={partner.id}>
            <Image src={partner.image} alt={partner.name} width={220} height={155} />
          </div>
        ))}
      </div>
      <div className="about-customer-dots" role="group" aria-label="Chọn khách hàng hiển thị nổi bật">
        {partners.map((partner) => (
          <button
            type="button"
            aria-label={`Đưa ${partner.name} vào giữa`}
            aria-pressed={center === partner.id}
            className={center === partner.id ? "active" : ""}
            key={partner.id}
            onClick={() => setCenter(partner.id)}
          />
        ))}
      </div>
    </>
  );
}
