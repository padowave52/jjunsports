import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "junsports_booking_v2";
const OPEN_HOUR = 10;
const CLOSE_HOUR = 18;
const LUNCH_HOUR = 12;

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

function Header() {
  const isAdmin = window.location.hash === "#/admin";
  return (
    <header className="hero">
      <div className="hero-text">
        <p className="eyebrow">쭌스포츠 스트링 예약</p>
        <h1>{isAdmin ? "관리자 페이지" : "라켓 스트링 예약 페이지"}</h1>
        <p className="hero-desc">
          당일 예약은 바로 작업, 맡김 예약은 방문일 기준 다음날 수령으로
          운영합니다.
        </p>
      </div>

      <div className="hero-info">
        <div className="info-card">
          <strong>운영일</strong>
          <span>월요일 ~ 토요일</span>
        </div>
        <div className="info-card">
          <strong>운영시간</strong>
          <span>10:00 ~ 18:00</span>
        </div>
        <div className="info-card">
          <strong>점심시간</strong>
          <span>12:00 ~ 13:00</span>
        </div>
      </div>
    </header>
  );
}

function NavBar() {
  return (
    <div className="top-nav">
      <a href="#/" className="nav-link">고객 예약 페이지</a>
      <a href="#/admin" className="nav-link">관리자 페이지</a>
    </div>
  );
}

function App() {
  const today = formatDate(new Date());
  const [route, setRoute] = useState(window.location.hash || "#/");
  const [data, setData] = useState(loadData());

  const [form, setForm] = useState({
    name: "",
    phone: "",
    type: "sameDay",
    date: today,
    time: "10:00",
  });

  const [adminDate, setAdminDate] = useState(today);
  const [copied, setCopied] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const pickupDate = form.type === "dropOff" ? addDays(form.date, 1) : null;

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
      pickupDate: form.type === "dropOff" ? addDays(form.date, 1) : "",
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
      return `[쭌스포츠] 예약이 승인되었습니다. 방문일시: ${booking.date} ${booking.time}, 수령 예정일: ${booking.pickupDate} 입니다.`;
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

  const isAdminPage = route === "#/admin";

  return (
    <div className="page">
      <NavBar />
      <Header />

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
                    value={form.phone}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              <div>
                <label>예약 유형</label>
                <div className="type-buttons">
                  <button
                    type="button"
                    className={form.type === "sameDay" ? "type-btn active" : "type-btn"}
                    onClick={() => setForm((prev) => ({ ...prev, type: "sameDay" }))}
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
                {pickupDate && (
                  <p><strong>맡김 예약 수령 예정일:</strong> {pickupDate}</p>
                )}
              </div>

              <div className="guide-box">
                <p>영업시간: 월~토 10:00~18:00 (일요일 휴무)</p>
                <p>점심시간: 12:00~13:00 예약 불가</p>
                <p>슬롯당 기본 예약 가능 수: {data.settings.slotLimit}건</p>
                <p>하루 총 예약 가능 수: {data.settings.dayLimit}건</p>
                <p>맡김 예약은 방문일 기준 다음날 수령 예정입니다.</p>
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
              현재 선택 날짜 예약 수: {dayBookings.length}건 / {data.settings.dayLimit}건
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
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="비밀번호 입력"
              />
              <button
                className="submit-btn"
                type="button"
                onClick={() => {
                  if (adminPin === "1234") {
                    setAdminUnlocked(true);
                  } else {
                    alert("비밀번호가 올바르지 않습니다.");
                  }
                }}
              >
                관리자 페이지 열기
              </button>
              <p className="small-guide">현재 기본 비밀번호는 1234 입니다. 나중에 변경 가능.</p>
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
                            <p>수령 예정일: {booking.pickupDate}</p>
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