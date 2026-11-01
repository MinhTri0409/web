import Link from "next/link";
import Image from "next/image";
import "./landing.css";
import LandingClientLogos from "../components/landing-client-logos";
import LandingNavigation from "../components/landing-navigation";
import { groupParkingSlots, parkingLocation } from "../lib/parking-layout";

export const dynamic = "force-dynamic";

type HomePrice = {
  vehicleType: string;
  turnPrice: number;
  reservationHourlyPrice: number | null;
  capacity: number;
};

type HomeData = {
  totalCapacity: number;
  availableSpaces: number;
  prices: HomePrice[];
  parkingSections: ParkingSection[];
  error?: string;
};

type ParkingSlotState = "AVAILABLE" | "OCCUPIED" | "RESERVED";

type ParkingSection = {
  type: string;
  label: string;
  capacity: number;
  used: number;
  slots: Array<{ code: string; state: ParkingSlotState }>;
};

const vehicleLabels: Record<string, string> = {
  MOTORBIKE: "Xe máy",
  MOTORELECTRIC: "Xe máy điện",
  CAR: "Ô tô",
};

async function getHomeData(): Promise<HomeData> {
  try {
    const springUrl = process.env.SPRING_BASE_URL ?? "http://localhost:8080";
    const response = await fetch(`${springUrl}/api/public/home`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Spring API returned ${response.status}`);
    const home = await response.json() as HomeData;
    return { ...home, parkingSections: Array.isArray(home.parkingSections) ? home.parkingSections : [] };
  } catch (error) {
    console.error("Could not load public parking data", error);
    return { totalCapacity: 0, availableSpaces: 0, prices: [], parkingSections: [], error: "Không tải được dữ liệu bãi xe. Vui lòng thử lại sau." };
  }
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function ParkingIllustration({ sections }: { sections: ParkingSection[] }) {
  return (
    <section className="landing-visual" aria-label="Sơ đồ vị trí đỗ xe hiện tại">
      <div className="visual-topline">
        <span><i className="status-dot" /> SƠ ĐỒ BÃI XE HIẾU MINH</span>
        <span>TRẠNG THÁI HIỆN TẠI</span>
      </div>
      <div className="parking-map-legend" aria-label="Chú giải trạng thái">
        <span><i className="map-state-available" /> Còn trống</span>
        <span><i className="map-state-occupied" /> Đang có xe</span>
        <span><i className="map-state-reserved" /> Đã đặt chỗ</span>
      </div>
      <div className="parking-map-sections">
        {sections.length ? sections.map((section) => {
          const occupied = section.slots.filter((slot) => slot.state === "OCCUPIED").length;
          const reserved = section.slots.filter((slot) => slot.state === "RESERVED").length;
          const available = section.slots.length - occupied - reserved;
          return <section className="parking-map-section" key={section.type} aria-label={`Khu vực ${section.label}`}>
            <header className="parking-map-section-heading">
              <span className={`parking-map-type-icon parking-map-type-${section.type.toLowerCase()}`} aria-hidden="true">
                {section.type === "CAR" ? "▰" : "◉"}
              </span>
              <strong>{section.label}</strong>
              <span>{available} / {section.capacity} trống</span>
            </header>
            <div className="parking-zone-grid">
              {groupParkingSlots(section.slots).map((zone) => <section className={`parking-zone parking-zone-${zone.index % 4}`} key={zone.label}>
                <header className="parking-zone-heading"><strong>{zone.label}</strong><small>{zone.corner}</small></header>
                <div className="parking-map-grid">
                  {zone.slots.map((slot) => {
                    const location = parkingLocation(slot.code);
                    return <div
                      className={`parking-map-slot parking-map-slot-${slot.state.toLowerCase()}`}
                      key={slot.code}
                      title={`${location.label} (${slot.code}): ${slot.state === "AVAILABLE" ? "Còn trống" : slot.state === "OCCUPIED" ? "Đang có xe" : "Đã đặt chỗ"}`}
                    >
                      <span className="parking-map-slot-icon" aria-hidden="true">{section.type === "CAR" ? "▰" : "◉"}</span>
                      <strong>{location.position}</strong>
                      <small>{slot.state === "AVAILABLE" ? "TRỐNG" : slot.state === "OCCUPIED" ? "ĐANG CÓ XE" : "ĐÃ ĐẶT"}</small>
                      <span className="parking-map-slot-id">{slot.code}</span>
                    </div>;
                  })}
                </div>
              </section>)}
            </div>
          </section>;
        }) : <p className="parking-map-empty">Chưa có dữ liệu sơ đồ bãi xe.</p>}
      </div>
      <div className="parking-map-road"><span />LỐI DI CHUYỂN<span /></div>
      <div className="parking-map-gate"><span aria-hidden="true">⌑</span> CỔNG VÀO / RA</div>
      <div className="visual-booking">
        <span className="booking-icon">✓</span>
        <span><strong>Chọn đúng vị trí trước khi đến</strong><small>Đặt chỗ để giữ vị trí theo khung giờ mong muốn</small></span>
        <b aria-hidden="true">↗</b>
      </div>
      <span className="visual-badge visual-badge-shield" aria-hidden="true">✓</span>
      <span className="visual-badge visual-badge-flash" aria-hidden="true">✦</span>
    </section>
  );
}

export default async function Home() {
  const data = await getHomeData();

  return (
    <div className="landing-page">
      <LandingNavigation />

      <main>
        <section className="landing-hero">
          <span className="hero-glow hero-glow-one" />
          <span className="hero-glow hero-glow-two" />
          <div className="landing-hero-inner">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow"><i /> TRẢI NGHIỆM GỬI XE CHỦ ĐỘNG</span>
              <h1>Đến nơi an tâm.<br /><span>Đã có chỗ đợi bạn.</span></h1>
              <p>Chọn loại xe, giờ gửi và vị trí đỗ trước khi khởi hành. Theo dõi xác nhận đặt chỗ ngay trên tài khoản của bạn.</p>
              <div className="landing-hero-actions">
                <Link className="landing-cta" href="/reservations">Đặt chỗ trực tuyến <span aria-hidden="true">→</span></Link>
                <a className="landing-text-link" href="#quy-trinh"><span className="play-icon">▶</span> Tìm hiểu cách đặt</a>
              </div>
              <div className="landing-trust-row">
                <span><i>✓</i> Chọn chỗ trước</span>
                <span><i>✓</i> Giá rõ ràng</span>
                <span><i>✓</i> Xác nhận minh bạch</span>
              </div>
            </div>
            <ParkingIllustration sections={data.parkingSections} />
          </div>
          <div className="landing-hero-bottom"><span>ĐẶT CHỖ DỄ DÀNG</span><i /><span>ĐỖ XE AN TÂM</span></div>
        </section>

        {data.error && <div className="landing-alert" role="alert">{data.error}</div>}

        <section className="landing-stats" aria-label="Thông tin bãi xe">
          <div className="landing-stat-intro"><span className="landing-eyebrow">SẴN SÀNG ĐÓN BẠN</span><strong>Chủ động chỗ đỗ,<br />trọn vẹn hành trình.</strong></div>
          <div className="landing-stat"><span className="stat-icon">P</span><strong>{data.error ? "—" : data.totalCapacity}</strong><small>Vị trí trong hệ thống</small></div>
          <div className="landing-stat"><span className="stat-icon stat-icon-green">✓</span><strong>{data.error ? "—" : data.availableSpaces}</strong><small>Vị trí trống trong giờ tới</small></div>
          <div className="landing-stat"><span className="stat-icon stat-icon-purple">◷</span><strong>24/7</strong><small>Tra cứu và đặt chỗ</small></div>
        </section>

        <section id="gioi-thieu" className="landing-section landing-about">
          <div className="landing-about-copy">
            <span className="landing-eyebrow">GIỚI THIỆU NHÀ XE</span>
            <h2>Nhà xe Hiếu Minh<br /><span>đồng hành trên mọi hành trình.</span></h2>
            <p>Chúng tôi cung cấp dịch vụ gửi xe và đặt chỗ trực tuyến, giúp khách hàng chủ động chọn loại xe, khung giờ và vị trí đỗ trước khi đến.</p>
            <p>Thông tin vị trí và chi phí được trình bày rõ ràng để bạn dễ dàng lên kế hoạch. Khách hàng có thể theo dõi các đơn đặt chỗ ngay trên tài khoản cá nhân.</p>
            <Link className="landing-about-link" href="/reservations">Khám phá đặt chỗ <span aria-hidden="true">→</span></Link>
          </div>
          <div className="landing-about-highlights" aria-label="Ưu điểm dịch vụ">
            <article><span className="highlight-icon">⌖</span><div><strong>Chủ động vị trí</strong><p>Chọn chỗ đỗ phù hợp trước khi khởi hành.</p></div></article>
            <article><span className="highlight-icon highlight-icon-blue">₫</span><div><strong>Chi phí minh bạch</strong><p>Xem giá dự kiến theo loại xe và thời lượng gửi.</p></div></article>
            <article><span className="highlight-icon highlight-icon-gold">✓</span><div><strong>Theo dõi thuận tiện</strong><p>Quản lý trạng thái đặt chỗ bằng tài khoản của bạn.</p></div></article>
          </div>
        </section>

        <section className="landing-section about-principles" aria-label="Tầm nhìn, sứ mệnh và giá trị cốt lõi">
          <article className="about-principle">
            <span className="principle-icon principle-icon-vision" aria-hidden="true">↗</span>
            <h3>Tầm nhìn</h3>
            <p>Trở thành đơn vị cung cấp hệ thống giám sát và quản lý bãi đỗ xe hiện đại, an toàn, được khách hàng tin tưởng lựa chọn.</p>
          </article>
          <article className="about-principle">
            <span className="principle-icon principle-icon-mission" aria-hidden="true">◎</span>
            <h3>Sứ mệnh</h3>
            <p>Mang đến giải pháp gửi xe thông minh, dễ sử dụng, giúp khách hàng chủ động tìm chỗ và giúp nhà xe vận hành hiệu quả hơn.</p>
          </article>
          <article className="about-principle">
            <span className="principle-icon principle-icon-values" aria-hidden="true">◇</span>
            <h3>Giá trị cốt lõi</h3>
            <p><strong>Giải pháp:</strong> Hỗ trợ quản lý vị trí và đặt chỗ rõ ràng.</p>
            <p><strong>Đồng hành:</strong> Hỗ trợ khách hàng trong quá trình sử dụng.</p>
            <p><strong>Linh hoạt:</strong> Cải tiến dịch vụ theo nhu cầu thực tế.</p>
          </article>
        </section>

        <section className="landing-section about-faqs" aria-label="Vấn đề khách hàng và giải pháp">
          <div className="about-faq-group">
            <h2>Vấn đề của khách hàng</h2>
            <div className="about-accordion">
              <details><summary>Chưa có hệ thống giữ xe thông minh</summary><p>Khách hàng khó biết trước vị trí còn trống, còn nhà xe phải kiểm tra và sắp xếp chỗ theo cách thủ công.</p></details>
              <details><summary>Hệ thống xuống cấp, lạc hậu</summary><p>Quy trình ghi nhận rời rạc có thể làm mất thời gian tra cứu thông tin và theo dõi lượt xe.</p></details>
              <details><summary>Hệ thống chưa đáp ứng đủ nhu cầu</summary><p>Thiếu thông tin về khung giờ, vị trí và chi phí khiến khách hàng khó chủ động kế hoạch gửi xe.</p></details>
            </div>
          </div>
          <div className="about-faq-group">
            <h2>Giải pháp của Hiếu Minh</h2>
            <div className="about-accordion">
              <details><summary>Cung cấp hệ thống quản lý rõ ràng</summary><p>Theo dõi sức chứa, vị trí đỗ và trạng thái đặt chỗ tập trung trên một giao diện.</p></details>
              <details><summary>Hỗ trợ theo dõi và cải thiện vận hành</summary><p>Thông tin lượt xe và lịch sử được tổ chức dễ tra cứu, hỗ trợ nhân viên xử lý công việc nhất quán.</p></details>
              <details><summary>Thiết kế dịch vụ linh hoạt theo nhu cầu</summary><p>Khách hàng chọn loại xe, thời gian và vị trí phù hợp; nhà xe có thể cập nhật bảng giá và sức chứa.</p></details>
            </div>
          </div>
        </section>

        <section className="landing-section about-customers" aria-labelledby="about-customers-title">
          <div className="about-customers-heading">
            <span className="landing-eyebrow">ĐỒNG HÀNH CÙNG CHÚNG TÔI</span>
            <h2 id="about-customers-title">Khách hàng của Hiếu Minh</h2>
            <p>Trân trọng sự tin tưởng và đồng hành của các khách hàng, đối tác.</p>
          </div>
          <LandingClientLogos />
        </section>

        <section className="landing-section about-team" aria-labelledby="about-team-title">
          <div className="about-team-heading">
            <span className="landing-eyebrow">ĐỘI NGŨ NHÀ XE HIẾU MINH</span>
            <h2 id="about-team-title">Đội ngũ chuyên gia</h2>
            <p>Những thành viên đồng hành phát triển và vận hành dịch vụ.</p>
          </div>
          <div className="about-team-grid">
            <article className="about-team-card">
              <div className="about-team-card-top"><div className="about-team-member">
                <Image className="about-team-avatar" src="/images/team-nguyen-duy.png" alt="Ảnh Nguyễn Duy" width={90} height={90} />
                <div><h3>NGUYỄN DUY</h3><span className="about-team-role">Tư vấn triển khai dự án</span></div>
              </div></div>
              <div className="about-team-description">-1000 năm kinh nghiệm dự án lớn/nhỏ tại Việt Nam</div>
            </article>
            <article className="about-team-card">
              <div className="about-team-card-top"><div className="about-team-member">
                <Image className="about-team-avatar about-team-avatar-blue" src="/images/team-tran-tri-dung.png" alt="Ảnh Trần Trí Dũng" width={90} height={90} />
                <div><h3>TRẦN TRÍ DŨNG</h3><span className="about-team-role">Phần mềm</span></div>
              </div></div>
              <div className="about-team-description">01 năm kinh nghiệm</div>
            </article>
            <article className="about-team-card">
              <div className="about-team-card-top"><div className="about-team-member">
                <Image className="about-team-avatar about-team-avatar-gold" src="/images/team-nguyen-luong-kiet.png" alt="Ảnh Nguyễn Lương Kiệt" width={90} height={90} />
                <div><h3>NGUYỄN LƯƠNG KIỆT</h3><span className="about-team-role">Kiểm tra - Đánh giá hệ thống</span></div>
              </div></div>
              <div className="about-team-description">-100tr năm kinh nghiệm</div>
            </article>
          </div>
        </section>

        <section id="dich-vu" className="landing-section landing-services">
          <div className="landing-section-heading">
            <div><span className="landing-eyebrow">MỘT ĐIỂM DỪNG, NHIỀU TIỆN ÍCH</span><h2>Gửi xe theo cách<br /><span>bạn mong muốn.</span></h2></div>
            <p>Từ lúc chọn vị trí đến khi nhận xe, mọi thông tin đặt chỗ được tập trung rõ ràng trong tài khoản của bạn.</p>
          </div>
          <div className="landing-service-grid">
            <article className="landing-service-card service-card-featured">
              <span className="service-number">01 / ĐẶT TRƯỚC</span><span className="service-icon">⌖</span>
              <h3>Chọn vị trí theo thời gian</h3><p>Xem chỗ còn trống theo khung giờ dự kiến, chọn vị trí phù hợp và hạn chế mất thời gian tìm chỗ khi đến nơi.</p>
              <Link href="/reservations">Chọn chỗ đỗ <span aria-hidden="true">↗</span></Link><i className="service-orbit" />
            </article>
            <article className="landing-service-card">
              <span className="service-number">02 / MINH BẠCH</span><span className="service-icon service-icon-blue">₫</span>
              <h3>Chi phí hiển thị trước</h3><p>Xem giá theo loại xe và thời lượng trước khi gửi yêu cầu đặt chỗ. Giá được cập nhật từ bảng giá của nhà xe.</p>
              <a href="#bang-gia">Xem bảng giá <span aria-hidden="true">↗</span></a>
            </article>
            <article className="landing-service-card">
              <span className="service-number">03 / AN TÂM</span><span className="service-icon service-icon-gold">✓</span>
              <h3>Xác nhận rõ ràng</h3><p>Theo dõi trạng thái đơn. Thanh toán chuyển khoản được nhân viên kiểm tra và xác nhận trước khi chỗ được giữ.</p>
              <Link href="/register">Tạo tài khoản khách <span aria-hidden="true">↗</span></Link>
            </article>
          </div>
        </section>

        <section id="quy-trinh" className="landing-process">
          <div className="landing-process-copy">
            <span className="landing-eyebrow">BẮT ĐẦU TRONG VÀI BƯỚC</span>
            <h2>Đặt chỗ gọn nhẹ.<br /><span>Sẵn sàng lên đường.</span></h2>
            <p>Không cần gọi hỏi chỗ. Chọn khung giờ, xem giá và gửi yêu cầu ngay trên website.</p>
            <Link className="landing-cta" href="/reservations">Bắt đầu đặt chỗ <span aria-hidden="true">→</span></Link>
          </div>
          <div className="landing-process-steps">
            <article><span>01</span><div><b>♙</b><h3>Tạo tài khoản khách</h3><p>Đăng ký nhanh để lưu và theo dõi đơn đặt chỗ của bạn.</p></div></article>
            <article><span>02</span><div><b>▦</b><h3>Chọn xe, giờ và vị trí</h3><p>Chỗ trống cùng chi phí dự kiến được hiển thị theo lựa chọn.</p></div></article>
            <article><span>03</span><div><b>▧</b><h3>Thanh toán, nhận xác nhận</h3><p>Chuyển khoản bằng QR; nhân viên kiểm tra giao dịch và xác nhận đơn.</p></div></article>
          </div>
        </section>

        <section id="bang-gia" className="landing-section landing-pricing">
          <div className="landing-section-heading">
            <div><span className="landing-eyebrow">GIÁ GỬI XE THEO GIỜ</span><h2>Biết trước chi phí.<br /><span>Yên tâm chọn chỗ.</span></h2></div>
            <p>Đơn giá tham khảo được đồng bộ từ bảng giá nhà xe. Tổng tiền chính xác được tính theo khung giờ bạn chọn.</p>
          </div>
          {data.prices.length > 0 ? (
            <div className="landing-pricing-grid">
              {data.prices.map((price) => (
                <article className="landing-price-card" key={price.vehicleType}>
                  <span className="price-vehicle-icon">{price.vehicleType === "CAR" ? "A" : price.vehicleType === "MOTORBIKE" ? "M" : "E"}</span>
                  <span className="price-vehicle-label">{vehicleLabels[price.vehicleType] ?? price.vehicleType}</span>
                  <strong className="price-amount">{formatPrice(price.reservationHourlyPrice ?? price.turnPrice)}<small> đ / giờ</small></strong>
                  <span className="price-capacity"><i>P</i> {price.capacity} vị trí</span>
                  <Link href={`/reservations?type=${encodeURIComponent(price.vehicleType)}`}>Đặt loại xe này <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          ) : !data.error && <p className="landing-empty-pricing">Bảng giá hiện chưa có dữ liệu.</p>}
          <p className="landing-pricing-note"><span aria-hidden="true">ⓘ</span> Thời lượng lẻ được làm tròn lên giờ tiếp theo. Đơn đặt giữ chỗ sau khi nhân viên xác nhận thanh toán.</p>
        </section>

        <section className="landing-cta-band">
          <div><span className="landing-eyebrow">HÀNH TRÌNH CỦA BẠN, BẮT ĐẦU TỪ MỘT CHỖ ĐỖ</span><h2>Đặt trước ngay hôm nay.</h2><p>Chọn vị trí phù hợp và để nhà xe sẵn sàng đón bạn.</p></div>
          <Link className="landing-cta landing-cta-light" href="/reservations">Đặt chỗ ngay <span aria-hidden="true">↗</span></Link>
        </section>

        <section id="lien-he" className="landing-section landing-contact">
          <div className="landing-section-heading">
            <div><span className="landing-eyebrow">NHÀ XE HIẾU MINH</span><h2>Liên hệ<br /><span>với chúng tôi.</span></h2></div>
            <p>Cần hỗ trợ về dịch vụ hoặc đặt chỗ? Hãy liên hệ với nhà xe qua các thông tin dưới đây.</p>
          </div>
          <div className="landing-contact-grid">
            <a className="landing-contact-card" href="tel:0862282415"><span className="contact-icon">☎</span><span className="contact-label">Điện thoại</span><strong>0862 282 415</strong><span className="contact-action">Gọi cho chúng tôi ↗</span></a>
            <a className="landing-contact-card" href="mailto:trantridung10122006@gmail.com"><span className="contact-icon contact-icon-blue">@</span><span className="contact-label">Email</span><strong>trantridung10122006@gmail.com</strong><span className="contact-action">Gửi email ↗</span></a>
            <a className="landing-contact-card" href="https://www.google.com/maps/search/?api=1&query=100%2F3%20Quang%20Trung%2C%20T%C4%83ng%20Nh%C6%A1n%20Ph%C3%BA%2C%20TPHCM" target="_blank" rel="noopener noreferrer"><span className="contact-icon contact-icon-gold">⌖</span><span className="contact-label">Địa chỉ</span><strong>100/3 Quang Trung, Tăng Nhơn Phú, TPHCM</strong><span className="contact-action">Xem bản đồ ↗</span></a>
          </div>
          <Link className="landing-contact-form-link" href="/contact">Gửi lời nhắn cho nhà xe <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/"><span className="landing-brand-mark">P</span><span>NHÀ XE <strong>HIẾU MINH</strong></span></Link>
        <span>Đặt chỗ thuận tiện · Gửi xe an tâm</span>
        <a href="#lien-he">Liên hệ</a>
        <Link href="/login">Đăng nhập hệ thống</Link>
      </footer>
    </div>
  );
}
