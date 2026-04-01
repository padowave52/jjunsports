import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "junsports_booking_v3";
const ADMIN_PASSWORD = "jjun5418";

const OPEN_HOUR = 10;
const CLOSE_HOUR = 18;
const LUNCH_HOUR = 12;
const SAME_DAY_BLOCK_MINUTES = 5;

const SITE_TEXT = {
  eyebrow: "쭌스포츠 스트링 예약",
  customerTitle: "라켓 스트링 예약 페이지",
  adminTitle: "관리자 페이지",
  heroDesc:
    "당일 예약은 바로 작업, 맡김 예약은 방문일 기준 다음날 오후 수령으로 운영",
  opDayLabel: "영업시간안내",
  opDayValue: "월~토 10:00~18:00 (일요일 휴무)",
  lunchLabel: "점심시간",
  lunchValue: "12:00 ~ 13:00",
  guide1: "영업시간: 월~토 10:00~18:00 (일요일 휴무)",
  guide2: "점심시간: 12:00~13:00 예약 불가",
  guide3: "당일 예약은 현재 시각 기준 지난 시간과 시작 5분 전부터 자동 마감됩니다.",
  guide4: "맡김 예약은 방문일 기준 일요일 제외 다음날 오후 수령 (작업완료 문자받고 수령)",
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function getNextPickupDate(dateStr) {
  let nextDate = addDays(dateStr, 1);
  while (isSunday(nextDate)) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
}

function getDayName(dateStr) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const date = new Date(`${dateStr}T00:00:00`);
  return days[date.getDay()];
}

function isSunday(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay() === 0;
}

function generateTimeSlots() {
  const slots = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    if (hour === LUNCH_HOUR) continue;
    slots.push(`${pad(hour)}:00`);
    slots.push(`${pad(hour)}:30`);
  }
  return slots;
}

const timeSlots = generateTimeSlots();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        bookings: [],
        closedDates: [],
        blockedSlots: {},
        settings: {
          slotLimit: 2,
          dayLimit: 15,
        },
      };
    }

    const parsed = JSON.parse(raw);
    return {
      bookings: parsed.bookings || [],
      closedDates: parsed.closedDates || [],
      blockedSlots: parsed.blockedSlots || {},
      settings: {
        slotLimit: parsed.settings?.slotLimit ?? 2,
        dayLimit: parsed.settings?.dayLimit ?? 15,
      },
    };
  } catch {
    return {
      bookings: [],
      closedDates: [],
      blockedSlots: {},
      settings: {
        slotLimit: 2,
        dayLimit: 15,
      },
    };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getNowInfo() {
  const now = new Date();
  return {
    now,
    today: formatDate(now),
  };
}

function getSlotDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

function isPastOrClosingSoon(dateStr, timeStr) {
  const { now, today } = getNowInfo();

  if (dateStr !== today) return false;

  const slotDate = getSlotDateTime(dateStr, timeStr);
  const diffMs = slotDate.getTime() - now.getTime();
  const diffMin = diffMs / 60000;

  return diffMin <= SAME_DAY_BLOCK_MINUTES;
}

function Header({ isAdminPage }) {
  return (
    <header className="hero">
      <div className="hero-text">
        <p className="eyebrow">{SITE_TEXT.eyebrow}</p>
        <h1>{isAdminPage ? SITE_TEXT.adminTitle : SITE_TEXT.customerTitle}</h1>
        <p className="hero-desc">{SITE_TEXT.heroDesc}</p>
      </div>

      <div className="hero-info">
        <div className="info-card">
          <strong>{SITE_TEXT.opDayLabel}</strong>
          <span>{SITE_TEXT.opDayValue}</span>
        </div>
        <div className="info-card">
          <strong>{SITE_TEXT.lunchLabel}</strong>
          <span>{SITE_TEXT.lunchValue}</span>
        </div>
      </div>
    </header>
  );
}

function CustomerTopOnly() {
  return null;
}

function AdminTopOnly() {
  return null;
}

function App() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  const [data, setData] = useState(loadData());
  const { today } = getNowInfo();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    type: "sameDay",
    date: today,
    time: "10:00",
    quantity: 1,
  });

  const [adminDate, setAdminDate] = useState(today);
  const [copied, setCopied] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const isAdminPage = route === "#/admin";
  const pickupDate =
    form.type === "dropOff" ? getNextPickupDate(form.date) : null;

  const activeBookings = useMemo(() => {
    return data.bookings.filter((b) => b.status !== "cancelled");
  }, [data.bookings]);

  function getDayCount(date) {
    return activeBookings.filter((b) => b.date === date).length;
  }

  function getSlotCount(date, time) {
    return activeBookings.filter((b) => b.date === date && b.time === time).length;
  }

  function getSlotStatus(date, time) {
    if (isSunday(date)) return "휴무";
    if (data.closedDates.includes(date)) return "휴무";
    if ((data.blockedSlots[date] || []).includes(time)) return "관리자 차단";

    if (isPastOrClosingSoon(date, time)) {
      return "마감";
    }

    if (getDayCount(date) >= Number(data.settings.dayLimit)) return "마감";
    if (getSlotCount(date, time) >= Number(data.settings.slotLimit)) return "마감";

    return "예약 가능";
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!form.phone.trim()) {
      alert("전화번호를 입력해주세요.");
      return;
    }

    if (form.phone.length < 10) {
      alert("전화번호를 정확히 입력해주세요.");
      return;
    }

    if (form.type === "dropOff" && Number(form.quantity) < 1) {
      alert("맡김 개수를 확인해주세요.");
      return;
    }

    const status = getSlotStatus(form.date, form.time);
    if (status !== "예약 가능") {
      alert(`선택한 시간은 현재 ${status} 상태입니다.`);
      return;
    }

    const newBooking = {
      id: Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      type: form.type,
      date: form.date,
      time: form.time,
      quantity: form.type === "dropOff" ? Number(form.quantity) || 1 : 1,
      pickupDate: form.type === "dropOff" ? getNextPickupDate(form.date) : "",
      status: "pending",
    };

    setData((prev) => ({
      ...prev,
      bookings: [newBooking, ...prev.bookings],
    }));

    alert("예약 신청이 완료되었습니다.");

    setForm({
      name: "",
      phone: "",
      type: "sameDay",
      date: today,
      time: "10:00",
      quantity: 1,
    });
  }

  function toggleClosedDate(date) {
    setData((prev) => ({
      ...prev,
      closedDates: prev.closedDates.includes(date)
        ? prev.closedDates.filter((d) => d !== date)
        : [...prev.closedDates, date],
    }));
  }

  function toggleBlockedSlot(date, time) {
    setData((prev) => {
      const current = prev.blockedSlots[date] || [];
      const next = current.includes(time)
        ? current.filter((t) => t !== time)
        : [...current, time];

      return {
        ...prev,
        blockedSlots: {
          ...prev.blockedSlots,
          [date]: next,
        },
      };
    });
  }

  function updateBookingStatus(id, status) {
    setData((prev) => ({
      ...prev,
      bookings: prev.bookings.map((booking) =>
        booking.id === id ? { ...booking, status } : booking
      ),
    }));
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  function getApproveMessage(booking) {
    if (booking.type === "dropOff") {
      return `[쭌스포츠] 예약이 승인되었습니다. 방문일시: ${booking.date} ${booking.time}, 맡김 수량: ${booking.quantity}개, 수령 예정일: ${booking.pickupDate} 입니다.`;
    }
    return `[쭌스포츠] 예약이 승인되었습니다. 방문일시: ${booking.date} ${booking.time} 입니다.`;
  }

  function getCompleteMessage() {
    return `[쭌스포츠] 맡겨주신 라켓 스트링 작업이 완료되었습니다. 편하신 시간에 방문 부탁드립니다.`;
  }

  const dayBookings = data.bookings.filter(
    (b) => b.date === form.date && b.status !== "cancelled"
  );

  const sortedBookings = [...data.bookings].sort((a, b) => {
    const aa = `${a.date} ${a.time}`;
    const bb = `${b.date} ${b.time}`;
    return aa.localeCompare(bb);
  });

  return (
    <div className="page">
      {isAdminPage ? <AdminTopOnly /> : <CustomerTopOnly />}
      {!isAdminPage && <Header isAdminPage={isAdminPage} />}

      {!isAdminPage ? (
        <main className="main-grid">
          <section className="card">
            <h2>예약 신청</h2>

            <form className="form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div>
                  <label>이름</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="이름 입력"
                  />
                </div>

                <div>
                  <label>전화번호</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 11);
                      setForm((prev) => ({ ...prev, phone: onlyNumbers }));
                    }}
                    placeholder="01012345678"
                  />
                </div>
              </div>

              <div>
                <label>예약 유형</label>
                <div className="type-buttons">
                  <button
                    type="button"
                    className={form.type === "sameDay" ? "type-btn active" : "type-btn"}
                    onClick={() => setForm((prev) => ({ ...prev, type: "sameDay", quantity: 1 }))}
                  >
                    당일 예약
                  </button>

                  <button
                    type="button"
                    className={form.type === "dropOff" ? "type-btn active" : "type-btn"}
                    onClick={() => setForm((prev) => ({ ...prev, type: "dropOff" }))}
                  >
                    맡김 예약
                  </button>
                </div>
              </div>

              {form.type === "dropOff" && (
                <div>
                  <label>맡기는 라켓 개수</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        quantity: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              )}

              <div className="form-row">
                <div>
                  <label>방문 날짜</label>
                  <input
                    type="date"
                    value={form.date}
                    min={today}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label>방문 시간</label>
                  <select
                    value={form.time}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, time: e.target.value }))
                    }
                  >
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} · {getSlotStatus(form.date, slot)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="notice-box">
                <p><strong>선택 날짜:</strong> {form.date} ({getDayName(form.date)})</p>
                <p><strong>선택 시간:</strong> {form.time}</p>
                <p><strong>상태:</strong> {getSlotStatus(form.date, form.time)}</p>
                {form.type === "dropOff" && (
                  <p><strong>맡김 개수:</strong> {form.quantity}개</p>
                )}
                {pickupDate && (
                  <p><strong>맡김 예약 수령 예정일:</strong> {pickupDate}</p>
                )}
              </div>

              <div className="guide-box">
                <p>{SITE_TEXT.guide1}</p>
                <p>{SITE_TEXT.guide2}</p>
                <p>슬롯당 기본 예약 가능 수: {data.settings.slotLimit}건</p>
                <p>하루 총 예약 가능 수: {data.settings.dayLimit}건</p>
                <p>{SITE_TEXT.guide3}</p>
                <p>{SITE_TEXT.guide4}</p>
              </div>

              <button className="submit-btn" type="submit">
                예약 신청하기
              </button>
            </form>
          </section>

          <section className="card">
            <h2>예약 가능 시간</h2>
            <div className="slot-grid">
              {timeSlots.map((slot) => (
                <div className="slot-item" key={slot}>
                  <span>{slot}</span>
                  <strong>{getSlotStatus(form.date, slot)}</strong>
                </div>
              ))}
            </div>

            <div className="day-summary">
              현재 선택 날짜 예약 수: {dayBookings.length}건
            </div>
          </section>
        </main>
      ) : (
        <section className="admin-section-single">
          {!adminUnlocked ? (
            <div className="card admin-lock-card">
              <h2>관리자 로그인</h2>
              <p className="lock-text">관리자 페이지는 비밀번호 입력 후 접근할 수 있습니다.</p>
              <label>관리자 비밀번호</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="비밀번호 입력"
              />
              <button
                className="submit-btn"
                type="button"
                onClick={() => {
                  if (adminPassword === ADMIN_PASSWORD) {
                    setAdminUnlocked(true);
                  } else {
                    alert("비밀번호가 올바르지 않습니다.");
                  }
                }}
              >
                관리자 페이지 열기
              </button>
            </div>
          ) : (
            <div className="admin-layout">
              <div className="card">
                <h2>관리자 설정</h2>

                <div className="form">
                  <div className="form-row">
                    <div>
                      <label>슬롯당 최대 예약 수</label>
                      <input
                        type="number"
                        min="1"
                        value={data.settings.slotLimit}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              slotLimit: Number(e.target.value) || 1,
                            },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label>하루 총 최대 예약 수</label>
                      <input
                        type="number"
                        min="1"
                        value={data.settings.dayLimit}
                        onChange={(e) =>
                          setData((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              dayLimit: Number(e.target.value) || 1,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label>설정 날짜</label>
                    <input
                      type="date"
                      value={adminDate}
                      onChange={(e) => setAdminDate(e.target.value)}
                    />
                  </div>

                  <button
                    className="toggle-btn"
                    type="button"
                    onClick={() => toggleClosedDate(adminDate)}
                  >
                    {data.closedDates.includes(adminDate)
                      ? "이 날짜 휴무 해제"
                      : "이 날짜 휴무 지정"}
                  </button>

                  <div>
                    <label>시간대 차단</label>
                    <div className="block-grid">
                      {timeSlots.map((slot) => {
                        const blocked = (data.blockedSlots[adminDate] || []).includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            className={blocked ? "block-btn active" : "block-btn"}
                            onClick={() => toggleBlockedSlot(adminDate, slot)}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>예약 목록</h2>

                {sortedBookings.length === 0 ? (
                  <p className="empty-text">아직 예약이 없습니다.</p>
                ) : (
                  <div className="booking-list">
                    {sortedBookings.map((booking) => (
                      <div className="booking-item" key={booking.id}>
                        <div>
                          <h3>{booking.name}</h3>
                          <p>{booking.phone}</p>
                          <p>
                            {booking.type === "sameDay" ? "당일 예약" : "맡김 예약"} /{" "}
                            {booking.date} {booking.time}
                          </p>
                          {booking.type === "dropOff" && (
                            <>
                              <p>맡김 개수: {booking.quantity}개</p>
                              <p>수령 예정일: {booking.pickupDate}</p>
                            </>
                          )}
                          <p>상태: {booking.status}</p>
                        </div>

                        <div className="booking-actions">
                          <button type="button" onClick={() => updateBookingStatus(booking.id, "approved")}>
                            승인
                          </button>
                          <button type="button" onClick={() => updateBookingStatus(booking.id, "completed")}>
                            완료
                          </button>
                          <button type="button" onClick={() => updateBookingStatus(booking.id, "cancelled")}>
                            취소
                          </button>
                          <button type="button" onClick={() => copyText(getApproveMessage(booking), `approve-${booking.id}`)}>
                            승인 문구 복사
                          </button>
                          <button type="button" onClick={() => copyText(getCompleteMessage(), `complete-${booking.id}`)}>
                            완료 문구 복사
                          </button>
                          <button type="button" onClick={() => copyText(booking.phone, `phone-${booking.id}`)}>
                            전화번호 복사
                          </button>
                        </div>

                        {copied.includes(String(booking.id)) && (
                          <div className="copied-text">복사되었습니다.</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
