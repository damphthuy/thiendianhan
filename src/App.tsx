import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, auth } from '@appdeploy/client';
import { toPng } from 'html-to-image';
import { generateLaSo } from 'tuvi-neo';
import { Lunar, Solar } from 'lunar-javascript';
import { Body, Constellation, Ecliptic, Equator, EquatorFromVector, GeoVector, Horizon, Observer, RotateVector, Rotation_HOR_EQJ, Spherical, VectorFromHorizon } from 'astronomy-engine';

const branches = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
const stems = ['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý'];
const palaceElements = ['Thủy','Thổ','Mộc','Mộc','Thổ','Hỏa','Hỏa','Thổ','Kim','Kim','Thổ','Thủy'];

const positions: Record<number, { row: number; col: number }> = {
  5:{row:1,col:1},6:{row:1,col:2},7:{row:1,col:3},8:{row:1,col:4},
  4:{row:2,col:1},9:{row:2,col:4},3:{row:3,col:1},10:{row:3,col:4},
  2:{row:4,col:1},1:{row:4,col:2},0:{row:4,col:3},11:{row:4,col:4},
};

const dvNames = ['ĐV.MỆNH','ĐV.PHỤ','ĐV.PHÚC','ĐV.ĐIỀN','ĐV.QUAN','ĐV.NÔ','ĐV.DI','ĐV.TẬT','ĐV.TÀI','ĐV.TỬ','ĐV.PHỐI','ĐV.HUYNH'];
const lnNames = ['LN.MỆNH','LN.PHỤ','LN.PHÚC','LN.ĐIỀN','LN.QUAN','LN.NÔ','LN.DI','LN.TẬT','LN.TÀI','LN.TỬ','LN.PHỐI','LN.HUYNH'];

const tuHoaByStem: Array<[string,string,string,string]> = [
  ['Liêm trinh','Phá quân','Vũ khúc','Thái dương'],
  ['Thiên cơ','Thiên lương','Tử vi','Thái âm'],
  ['Thiên đồng','Thiên cơ','Văn xương','Liêm trinh'],
  ['Thái âm','Thiên đồng','Thiên cơ','Cự môn'],
  ['Tham lang','Thái âm','Hữu bật','Thiên cơ'],
  ['Vũ khúc','Tham lang','Thiên lương','Văn khúc'],
  ['Thái dương','Vũ khúc','Thái âm','Thiên đồng'],
  ['Cự môn','Thái dương','Văn khúc','Văn xương'],
  ['Thiên lương','Tử vi','Tả phù','Vũ khúc'],
  ['Phá quân','Cự môn','Thái âm','Tham lang'],
];

const tuHoaSchools = [
  'Trung Châu Phái K.T.Môn',
  'TVĐST.Thư Mân Phái',
  'Trung Châu Phái V.Đ.Chi',
  'TVĐST.Thư Bắc Phái',
];

type FormState = {
  name: string;
  gender: 'male' | 'female';
  date: string;
  time: string;
  calendar: 'solar' | 'lunar';
  viewYear: number;
  viewMonth: number;
};

type Chart = ReturnType<typeof generateLaSo>;

type AnnualLayer = {
  year: number;
  month: number;
  stem: string;
  branch: string;
  age: number;
  birthYear: number;
  birthStemIndex: number;
  birthBranchIndex: number;
  annualStars: string[][];
  majorStartAge: number[];
  dvLabels: string[];
  lnLabels: string[];
  palaceStemIndices: number[];
  tieuHanBranches: string[];
  currentTieuHanIndex: number;
  currentDaiVanIndex: number;
  monthNumbersByPalace: number[];
  monthOneIndex: number;
  currentMonthIndex: number;
  amDuongRelation: string;
};

type ResultState = {
  chart: Chart;
  annual: AnnualLayer;
  form: FormState;
};

type ViewMode = 'overview' | 'palaces' | 'major' | 'minor';

type SavedChart = {
  id: string;
  form: FormState;
};

const fallbackForm: FormState = {
  name: '',
  gender: 'female',
  date: '',
  time: '',
  calendar: 'solar',
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth() + 1,
};

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function moveOneBased(start: number, delta: number) {
  return mod(start - 1 + delta, 12) + 1;
}

function canChiForYear(year: number) {
  const stemIndex = mod(year + 6, 10);
  const branchIndex = mod(year + 8, 12);
  return {
    stemIndex,
    branchIndex,
    stem: stems[stemIndex],
    branch: branches[branchIndex],
    label: stems[stemIndex] + ' ' + branches[branchIndex],
  };
}

function formatDateDMY(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function parseDateDMY(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1800 || year > 2200 || month < 1 || month > 12) return '';
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return '';
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function formatDateTyping(raw: string) {
  const digits = raw.replace(/\D/g,'').slice(0,8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}

function parseTime24(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function formatTimeTyping(raw: string) {
  const digits = raw.replace(/\D/g,'').slice(0,4);
  return digits.length <= 2 ? digits : `${digits.slice(0,2)}:${digits.slice(2)}`;
}

function DateDMYInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [text,setText] = useState(formatDateDMY(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setText(formatDateDMY(value));
      emitted.current = value;
    }
  }, [value]);

  function handleChange(raw: string) {
    const nextText = formatDateTyping(raw);
    const nextValue = parseDateDMY(nextText);
    setText(nextText);
    emitted.current = nextValue;
    onChange(nextValue);
  }

  return <label className="date-time-control">{label}<input type="text" inputMode="numeric" autoComplete="off" maxLength={10} value={text} onChange={event => handleChange(event.target.value)} placeholder="DD/MM/YYYY"/><small>Ngày / Tháng / Năm</small></label>;
}

function Time24Input({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [text,setText] = useState(value);
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      setText(value);
      emitted.current = value;
    }
  }, [value]);

  function handleChange(raw: string) {
    const nextText = formatTimeTyping(raw);
    const nextValue = parseTime24(nextText);
    setText(nextText);
    emitted.current = nextValue;
    onChange(nextValue);
  }

  return <label className="date-time-control">{label}<input type="text" inputMode="numeric" autoComplete="off" maxLength={5} value={text} onChange={event => handleChange(event.target.value)} placeholder="00:00"/><small>24 giờ · 00:00–23:59</small></label>;
}

function palaceStemIndex(birthStemIndex: number, branchIndex: number) {
  const canNamOneBased = birthStemIndex + 1;
  const cungOneBased = branchIndex + 1;
  const canOneBased = ((canNamOneBased % 5 * 2 + ((cungOneBased + 9) % 12)) % 10) + 1;
  return canOneBased - 1;
}

function readInitialForm(): FormState {
  if (typeof window === 'undefined') return fallbackForm;
  const params = new URLSearchParams(window.location.search);
  const gender = params.get('gender');
  const calendar = params.get('calendar');
  const year = Number(params.get('viewYear'));
  const month = Number(params.get('viewMonth'));

  return {
    name: params.get('name') || '',
    gender: gender === 'male' ? 'male' : 'female',
    date: params.get('date') || '',
    time: params.get('time') || '',
    calendar: calendar === 'lunar' ? 'lunar' : 'solar',
    viewYear: Number.isInteger(year) && year > 0 ? year : fallbackForm.viewYear,
    viewMonth: Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallbackForm.viewMonth,
  };
}

function readSavedCharts(): SavedChart[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('tuvi.savedCharts');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedChart[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildChart(form: FormState) {
  const [year, month, day] = form.date.split('-').map(Number);
  const [hour, minute] = form.time.split(':').map(Number);
  return generateLaSo({
    name: form.name,
    gender: form.gender,
    birth: {
      isLunar: form.calendar === 'lunar',
      year,
      month,
      day,
      hour,
      minute,
    },
  });
}

function resolveBirthYear(chart: Chart, enteredYear: number) {
  const natalLabel = chart.Info.Nam.toLocaleLowerCase('vi-VN').replace('tị','tỵ');
  const same = canChiForYear(enteredYear).label.toLocaleLowerCase('vi-VN');
  if (same === natalLabel) return enteredYear;
  const previous = canChiForYear(enteredYear - 1).label.toLocaleLowerCase('vi-VN');
  return previous === natalLabel ? enteredYear - 1 : enteredYear;
}

function findStarBranch(chart: Chart, starName: string) {
  const target = starName.toLocaleLowerCase('vi-VN');
  return chart.Cac_cung.findIndex(cung => {
    const names = [
      ...cung.ChinhTinh.map(s => s.Name),
      ...cung.Saotot.map(s => s.Name),
      ...cung.Saoxau.map(s => s.Name),
    ];
    return names.some(name => name.toLocaleLowerCase('vi-VN') === target);
  });
}

function buildTieuHanBranches(birthBranchIndex: number, gender: FormState['gender']) {
  const chiNamOneBased = birthBranchIndex + 1;
  const genderSign = gender === 'male' ? 1 : -1;
  const khoiHan = moveOneBased(11, -3 * (chiNamOneBased - 1));
  const viTriCungTy = moveOneBased(khoiHan, -genderSign * (chiNamOneBased - 1));

  return Array.from({ length: 12 }, (_, branchIndex) => {
    const cungOneBased = branchIndex + 1;
    const distance = genderSign === 1
      ? mod(cungOneBased - viTriCungTy, 12)
      : mod(viTriCungTy - cungOneBased, 12);
    return branches[distance];
  });
}

function buildMonthRing(chart: Chart, currentTieuHanIndex: number, viewMonth: number) {
  const lunarBirthMonth = Number(chart.Info.Thang);
  const normalizedHour = chart.Info.Gio.replace('Tị','Tỵ');
  const hourBranchIndex = Math.max(0, branches.findIndex(branch => branch === normalizedHour));

  const monthOneIndex = mod(
    currentTieuHanIndex - (lunarBirthMonth - 1) + hourBranchIndex,
    12,
  );

  const monthNumbersByPalace = Array.from({ length: 12 }, (_, palaceIndex) =>
    mod(palaceIndex - monthOneIndex, 12) + 1
  );

  const currentMonthIndex = mod(monthOneIndex + (viewMonth - 1), 12);

  return { monthOneIndex, monthNumbersByPalace, currentMonthIndex };
}

function annualFor(chart: Chart, form: FormState): AnnualLayer {
  const view = canChiForYear(form.viewYear);
  const enteredBirthYear = Number(form.date.slice(0, 4));
  const birthYear = resolveBirthYear(chart, enteredBirthYear);
  const birth = canChiForYear(birthYear);
  const annualStars = Array.from({ length: 12 }, () => [] as string[]);
  const add = (branchIndex: number, name: string) => annualStars[mod(branchIndex, 12)].push(name);

  add(view.branchIndex, 'L.Thái Tuế');
  add(view.branchIndex + 2, 'L.Tang Môn');
  add(view.branchIndex + 8, 'L.Bạch Hổ');
  add(view.branchIndex + 9, 'L.Phúc Đức');
  add(view.branchIndex + 9, 'L.Thiên Đức');
  add(view.branchIndex + 5, 'L.Nguyệt Đức');

  const locTonByStem = [2,3,5,6,5,6,8,9,11,0];
  const locTon = locTonByStem[view.stemIndex];
  add(locTon, 'L.Lộc Tồn');
  add(locTon + 1, 'L.Kình Dương');
  add(locTon - 1, 'L.Đà La');

  const khoiByStem = [1,0,11,11,1,0,2,2,3,3];
  const khoi = khoiByStem[view.stemIndex];
  const viet = mod(8 - khoi, 12);
  add(khoi, 'L.Thiên Khôi');
  add(viet, 'L.Thiên Việt');

  const chiOneBased = view.branchIndex + 1;
  const maRemainder = chiOneBased % 4;
  const thienMa = maRemainder === 1 ? 2 : maRemainder === 2 ? 11 : maRemainder === 3 ? 8 : 5;
  const kiepSat = mod(thienMa + 3, 12);
  const daoHoa = mod(kiepSat + 4, 12);
  const hongLoan = mod(3 - view.branchIndex, 12);
  add(thienMa, 'L.Thiên Mã');
  add(kiepSat, 'L.Kiếp Sát');
  add(daoHoa, 'L.Đào Hoa');
  add(hongLoan, 'L.Hồng Loan');
  add(hongLoan + 6, 'L.Thiên Hỷ');
  add(6 + view.branchIndex, 'L.Thiên Hư');
  add(6 - view.branchIndex, 'L.Thiên Khốc');

  const [locStar, quyenStar, khoaStar, kyStar] = tuHoaByStem[view.stemIndex];
  const transformations: Array<[string, string]> = [
    [locStar, 'L.Hóa Lộc'],
    [quyenStar, 'L.Hóa Quyền'],
    [khoaStar, 'L.Hóa Khoa'],
    [kyStar, 'L.Hóa Kỵ'],
  ];
  transformations.forEach(([star, label]) => {
    const branch = findStarBranch(chart, star);
    if (branch >= 0) add(branch, label);
  });

  const menhIndex = chart.Cac_cung.findIndex(c => c.Name.toLocaleLowerCase('vi-VN') === 'mệnh');
  const birthIsYang = birth.stemIndex % 2 === 0;
  const forward = (form.gender === 'male' && birthIsYang) || (form.gender === 'female' && !birthIsYang);
  const direction = forward ? 1 : -1;

  const majorStartAge = Array.from({ length: 12 }, (_, branchIndex) => {
    const distance = direction === 1 ? mod(branchIndex - menhIndex, 12) : mod(menhIndex - branchIndex, 12);
    return chart.Info.CucNH + distance * 10;
  });

  const age = form.viewYear - birthYear + 1;
  const cycleAge = mod(age - 1, 120) + 1;
  let currentDaiVanIndex = majorStartAge.findIndex(start => cycleAge >= start && cycleAge < start + 10);
  if (currentDaiVanIndex < 0) currentDaiVanIndex = menhIndex;

  const dvLabels = Array.from({ length: 12 }, (_, branchIndex) =>
    dvNames[mod(branchIndex - currentDaiVanIndex, 12)]
  );

  const lnLabels = Array.from({ length: 12 }, (_, branchIndex) =>
    lnNames[mod(branchIndex - view.branchIndex, 12)]
  );

  const tieuHanBranches = buildTieuHanBranches(birth.branchIndex, form.gender);
  const currentTieuHanIndex = Math.max(
    0,
    tieuHanBranches.findIndex(branch => branch === view.branch),
  );

  const monthRing = buildMonthRing(chart, currentTieuHanIndex, form.viewMonth);
  const palaceStemIndices = Array.from({ length: 12 }, (_, branchIndex) =>
    palaceStemIndex(birth.stemIndex, branchIndex)
  );

  return {
    year: form.viewYear,
    month: form.viewMonth,
    stem: view.stem,
    branch: view.branch,
    age,
    birthYear,
    birthStemIndex: birth.stemIndex,
    birthBranchIndex: birth.branchIndex,
    annualStars,
    majorStartAge,
    dvLabels,
    lnLabels,
    palaceStemIndices,
    tieuHanBranches,
    currentTieuHanIndex,
    currentDaiVanIndex,
    monthNumbersByPalace: monthRing.monthNumbersByPalace,
    monthOneIndex: monthRing.monthOneIndex,
    currentMonthIndex: monthRing.currentMonthIndex,
    amDuongRelation: forward ? 'Âm Dương Thuận Lý' : 'Âm Dương Nghịch Lý',
  };
}

function generateResult(form: FormState): ResultState {
  const chart = buildChart(form);
  return { chart, annual: annualFor(chart, form), form: { ...form } };
}

function getMenhIndex(chart: Chart) {
  const index = chart.Cac_cung.findIndex(cung => cung.Name.toLocaleLowerCase('vi-VN') === 'mệnh');
  return index >= 0 ? index : 11;
}

function relationTargets(selected: number) {
  return {
    tamHop: [mod(selected + 4, 12), mod(selected + 8, 12)],
    doiCung: mod(selected + 6, 12),
  };
}

function boardPoint(index: number) {
  const pos = positions[index];
  return {
    x: (pos.col - 0.5) * 25,
    y: (pos.row - 0.5) * 25,
  };
}

function RelationOverlay({ selected }: { selected: number }) {
  const relation = relationTargets(selected);
  const selectedPoint = boardPoint(selected);
  const tam1 = boardPoint(relation.tamHop[0]);
  const tam2 = boardPoint(relation.tamHop[1]);
  const opposite = boardPoint(relation.doiCung);

  return (
    <svg
      className="relation-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline
        className="tam-hop-shape"
        points={`${selectedPoint.x},${selectedPoint.y} ${tam1.x},${tam1.y} ${tam2.x},${tam2.y} ${selectedPoint.x},${selectedPoint.y}`}
        fill="none"
        stroke="#982f39"
        strokeWidth="0.42"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="doi-cung-line"
        x1={selectedPoint.x}
        y1={selectedPoint.y}
        x2={opposite.x}
        y2={opposite.y}
        fill="none"
        stroke="#235f78"
        strokeWidth="0.42"
        strokeDasharray="1.6 1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {[selectedPoint, tam1, tam2].map((point, index) => (
        <circle
          className="relation-node tam-node"
          cx={point.x}
          cy={point.y}
          r="0.75"
          fill="#982f39"
          stroke="#ffffff"
          strokeWidth="0.18"
          vectorEffect="non-scaling-stroke"
          key={index}
        />
      ))}
      <circle
        className="relation-node doi-node"
        cx={opposite.x}
        cy={opposite.y}
        r="0.75"
        fill="#235f78"
        stroke="#ffffff"
        strokeWidth="0.18"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const initialForm = readInitialForm();
const initialResult = initialForm.name && initialForm.date && initialForm.time
  ? generateResult(initialForm)
  : null;

function TuViPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<ResultState | null>(initialResult);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [selectedPalace, setSelectedPalace] = useState(() => initialResult ? getMenhIndex(initialResult.chart) : 0);
  const [showRelations, setShowRelations] = useState(true);
  const [showClickPanel, setShowClickPanel] = useState(true);
  const [showTuHoa, setShowTuHoa] = useState(true);
  const [hideBirthInfo, setHideBirthInfo] = useState(false);
  const [monochrome, setMonochrome] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [tuHoaSchool, setTuHoaSchool] = useState(tuHoaSchools[0]);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(readSavedCharts);
  const chartRef = useRef<HTMLElement | null>(null);

  function applyResult(nextForm: FormState) {
    const nextResult = generateResult(nextForm);
    setForm(nextForm);
    setResult(nextResult);
    setSelectedPalace(getMenhIndex(nextResult.chart));
    setError('');
    setNotice('');
  }

  function handleGenerate() {
    try {
      if (!form.name.trim() || !form.date || !form.time) {
        throw new Error('Nhập đủ họ tên, ngày sinh và giờ sinh.');
      }
      const birthYear = Number(form.date.slice(0, 4));
      if (!Number.isInteger(form.viewYear) || form.viewYear < birthYear) {
        throw new Error('Năm xem phải bằng hoặc sau năm sinh.');
      }
      if (!Number.isInteger(form.viewMonth) || form.viewMonth < 1 || form.viewMonth > 12) {
        throw new Error('Tháng xem phải từ 1 đến 12.');
      }
      applyResult(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lập lá số.');
    }
  }

  async function handleDownload() {
    if (!result || !chartRef.current || downloading) return;
    const exportTarget = chartRef.current;
    try {
      setDownloading(true);

      // Lớp tam phương/tứ chính dùng SVG chỉ có stroke + thuộc tính màu inline,
      // nên có thể giữ nguyên khi rasterize mà không tạo polygon đen.
      const dataUrl = await toPng(exportTarget, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#fbf7ee',
      });
      const safeName = result.form.name
        .trim()
        .replace(/[^a-zA-Z0-9À-ỹ]+/g, '-')
        .replace(/^-|-$/g, '') || 'la-so-tu-vi';
      const link = document.createElement('a');
      link.download = `${safeName}-${result.annual.year}-thang-${result.annual.month}.png`;
      link.href = dataUrl;
      link.click();
      setNotice('Đã tạo ảnh PNG của toàn bộ lá số.');
    } catch {
      setError('Không thể xuất ảnh lá số. Hãy thử lại một lần nữa.');
    } finally {
      setDownloading(false);
    }
  }

  function handleSave() {
    if (!result) return;
    const id = [
      result.form.name.trim().toLocaleLowerCase('vi-VN'),
      result.form.gender,
      result.form.date,
      result.form.time,
    ].join('|');

    const next: SavedChart[] = [
      { id, form: result.form },
      ...savedCharts.filter(item => item.id !== id),
    ].slice(0, 20);

    setSavedCharts(next);
    window.localStorage.setItem('tuvi.savedCharts', JSON.stringify(next));
    setNotice('Đã lưu lá số này trên trình duyệt.');
  }

  function handleLoadSaved(id: string) {
    const saved = savedCharts.find(item => item.id === id);
    if (!saved) return;
    applyResult(saved.form);
    setNotice('Đã mở lá số đã lưu.');
  }

  function buildShareUrl() {
    if (!result) return window.location.href;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('name', result.form.name);
    url.searchParams.set('gender', result.form.gender);
    url.searchParams.set('date', result.form.date);
    url.searchParams.set('time', result.form.time);
    url.searchParams.set('calendar', result.form.calendar);
    url.searchParams.set('viewYear', String(result.form.viewYear));
    url.searchParams.set('viewMonth', String(result.form.viewMonth));
    return url.toString();
  }

  async function handleShare() {
    if (!result) return;
    const url = buildShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Lá số Tử Vi - ${result.form.name}`,
          url,
        });
        setNotice('Đã mở bảng chia sẻ lá số.');
        return;
      }
    } catch {
      // Người dùng đóng bảng chia sẻ thì rơi xuống phương án sao chép link.
    }

    try {
      await navigator.clipboard.writeText(url);
      setNotice('Đã sao chép link lá số.');
    } catch {
      setNotice(url);
    }
  }

  async function handleFullscreen() {
    if (!chartRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await chartRef.current.requestFullscreen();
      }
    } catch {
      setError('Trình duyệt không cho mở toàn màn hình.');
    }
  }

  if (!result) {
    return (
      <main className="page tuvi-page">
        <header className="hero compact-hero">
          <div>
            <p className="eyebrow">TỬ VI ĐẨU SỐ · MỆNH BÀN & VẬN HẠN</p>
            <h1>Lập Lá Số Tử Vi</h1>
            <p className="subtitle">Không dùng dữ liệu mẫu. Nhập đúng thông tin sinh để bắt đầu.</p>
          </div>
          <span className="version">RULE ENGINE</span>
        </header>
        <section className="panel form-panel">
          <div className="form-grid">
            <label>Họ tên<input placeholder="Nhập tên hồ sơ" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label>
            <label>Giới tính<select value={form.gender} onChange={e => setForm({...form, gender:e.target.value as FormState['gender']})}><option value="female">Nữ</option><option value="male">Nam</option></select></label>
            <DateDMYInput label="Ngày sinh" value={form.date} onChange={date => setForm({...form,date})}/>
            <Time24Input label="Giờ sinh" value={form.time} onChange={time => setForm({...form,time})}/>
            <label>Lịch nhập<select value={form.calendar} onChange={e => setForm({...form, calendar:e.target.value as FormState['calendar']})}><option value="solar">Dương lịch</option><option value="lunar">Âm lịch</option></select></label>
            <label>Năm xem<input type="number" min="1900" max="2200" value={form.viewYear} onChange={e => setForm({...form, viewYear:Number(e.target.value)})}/></label>
            <label>Tháng xem<select value={form.viewMonth} onChange={e => setForm({...form, viewMonth:Number(e.target.value)})}>{Array.from({length:12}, (_,i) => i + 1).map(month => <option value={month} key={month}>Tháng {month}</option>)}</select></label>
          </div>
          <button className="generate" onClick={handleGenerate}>LẬP LÁ SỐ</button>
          {error && <div className="error">{error}</div>}
        </section>
        <section className="empty-chart-state">
          <div className="empty-symbol">命</div>
          <div><strong>Chưa có lá số</strong><p>Ứng dụng chỉ dựng mệnh bàn sau khi bạn nhập đủ họ tên, ngày sinh và giờ sinh.</p></div>
        </section>
      </main>
    );
  }

  const { chart, annual, form: generated } = result;
  const annualCount = annual.annualStars.reduce((sum, stars) => sum + stars.length, 0);
  const currentTieuHanPalace = chart.Cac_cung[annual.currentTieuHanIndex];
  const currentDaiVanPalace = chart.Cac_cung[annual.currentDaiVanIndex];
  const currentMonthPalace = chart.Cac_cung[annual.currentMonthIndex];

  const relation = relationTargets(selectedPalace);
  const selected = chart.Cac_cung[selectedPalace];
  const tamHopPalaces = relation.tamHop.map(index => chart.Cac_cung[index]);
  const doiCungPalace = chart.Cac_cung[relation.doiCung];

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">TỬ VI ĐẨU SỐ · MỆNH BÀN & VẬN HẠN</p>
          <h1>Lá Số Tử Vi</h1>
          <p className="subtitle">Mệnh bàn gốc · Tam phương tứ chính · Đại vận · Lưu niên · Tiểu hạn · Vòng 12 tháng</p>
        </div>
        <span className="version">V5</span>
      </header>

      <section className="panel form-panel">
        <div className="form-grid">
          <label>Họ tên
            <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
          </label>
          <label>Giới tính
            <select value={form.gender} onChange={e => setForm({...form, gender:e.target.value as FormState['gender']})}>
              <option value="female">Nữ</option>
              <option value="male">Nam</option>
            </select>
          </label>
          <DateDMYInput label="Ngày sinh" value={form.date} onChange={date => setForm({...form,date})}/>
          <Time24Input label="Giờ sinh" value={form.time} onChange={time => setForm({...form,time})}/>
          <label>Lịch nhập
            <select value={form.calendar} onChange={e => setForm({...form, calendar:e.target.value as FormState['calendar']})}>
              <option value="solar">Dương lịch</option>
              <option value="lunar">Âm lịch</option>
            </select>
          </label>
          <label>Năm xem
            <input type="number" min="1900" max="2200" value={form.viewYear} onChange={e => setForm({...form, viewYear:Number(e.target.value)})}/>
          </label>
          <label>Tháng xem
            <select value={form.viewMonth} onChange={e => setForm({...form, viewMonth:Number(e.target.value)})}>
              {Array.from({length:12}, (_,i) => i + 1).map(month => <option value={month} key={month}>Tháng {month}</option>)}
            </select>
          </label>
        </div>
        <button className="generate" onClick={handleGenerate}>LẬP LÁ SỐ</button>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="chart-toolbar">
        <div className="toolbar-row">
          <div className="mode-tabs" aria-label="Chế độ xem">
            {([
              ['overview','Tổng quan'],
              ['palaces','12 cung'],
              ['major','Đại vận'],
              ['minor','Tiểu vận'],
            ] as Array<[ViewMode,string]>).map(([mode,label]) => (
              <button
                className={viewMode === mode ? 'mode-tab active' : 'mode-tab'}
                onClick={() => setViewMode(mode)}
                key={mode}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="display-options">
            <label className="check-option">
              <input type="checkbox" checked={showRelations} onChange={e => setShowRelations(e.target.checked)}/>
              <span>Xem cung chiếu</span>
            </label>
            <label className="check-option">
              <input type="checkbox" checked={showClickPanel} onChange={e => setShowClickPanel(e.target.checked)}/>
              <span>Thông tin khi Click cung</span>
            </label>
            <label className="check-option">
              <input type="checkbox" checked={showTuHoa} onChange={e => setShowTuHoa(e.target.checked)}/>
              <span>Xem Tứ Hóa</span>
            </label>
            <label className="check-option">
              <input type="checkbox" checked={hideBirthInfo} onChange={e => setHideBirthInfo(e.target.checked)}/>
              <span>Ẩn thông tin sinh</span>
            </label>
            <label className="check-option">
              <input type="checkbox" checked={monochrome} onChange={e => setMonochrome(e.target.checked)}/>
              <span>Đen trắng</span>
            </label>
          </div>
        </div>

        <div className="toolbar-row secondary">
          <label className="school-picker">Tứ Hóa phái
            <select value={tuHoaSchool} onChange={e => setTuHoaSchool(e.target.value)}>
              {tuHoaSchools.map((school, index) => (
                <option value={school} key={school} disabled={index !== 0}>{school}{index !== 0 ? ' · đang khóa rule' : ''}</option>
              ))}
            </select>
          </label>

          <label className="saved-picker">Lá số đã lưu
            <select defaultValue="" onChange={e => handleLoadSaved(e.target.value)}>
              <option value="">Chọn lá số…</option>
              {savedCharts.map(item => (
                <option value={item.id} key={item.id}>
                  {item.form.name} · {item.form.date}
                </option>
              ))}
            </select>
          </label>

          <div className="toolbar-actions">
            <button onClick={handleSave}>Lưu lá số</button>
            <button onClick={handleDownload}>{downloading ? 'Đang tạo ảnh…' : 'Tải ảnh'}</button>
            <button onClick={() => window.print()}>In lá số</button>
            <button onClick={handleFullscreen}>Toàn màn hình</button>
            <button onClick={handleShare}>Chia sẻ</button>
          </div>
        </div>

        {notice && <div className="notice">{notice}</div>}
      </section>

      <section className="status status-rich">
        <span><small>Năm xem</small><b>{annual.year} · {annual.stem} {annual.branch}</b></span>
        <span><small>Tháng xem</small><b>Tháng {annual.month}</b></span>
        <span><small>Tuổi mụ</small><b>{annual.age}</b></span>
        <span><small>Đại vận</small><b>{currentDaiVanPalace?.Name}</b></span>
        <span><small>Tiểu hạn năm</small><b>{currentTieuHanPalace?.Name}</b></span>
        <span><small>Lưu nguyệt</small><b>{currentMonthPalace?.Name}</b></span>
        <span><small>Sao lưu</small><b>{annualCount}</b></span>
      </section>

      <div className="chart-shell">
        <div className="chart-scroll">
          <section
            className={[
              'chart-board',
              `mode-${viewMode}`,
              monochrome ? 'is-monochrome' : '',
            ].filter(Boolean).join(' ')}
            ref={chartRef}
          >
            {showRelations && <RelationOverlay selected={selectedPalace}/>}

            {chart.Cac_cung.map((palace, index) => {
              const pos = positions[index];
              const tags = [palace.Than ? 'THÂN' : '', palace.Tuan ? 'TUẦN' : '', palace.Triet ? 'TRIỆT' : ''].filter(Boolean);
              const majorStart = annual.majorStartAge[index];
              const stem = stems[annual.palaceStemIndices[index]];
              const branch = branches[index];
              const polarity = index % 2 === 0 ? '+' : '−';
              const activeTieuHan = index === annual.currentTieuHanIndex;
              const activeDaiVan = index === annual.currentDaiVanIndex;
              const activeMonth = index === annual.currentMonthIndex;
              const monthNo = annual.monthNumbersByPalace[index];
              const isSelected = index === selectedPalace;
              const isTamHop = relation.tamHop.includes(index);
              const isDoiCung = relation.doiCung === index;

              return (
                <article
                  className={[
                    'palace',
                    activeTieuHan ? 'is-tieu-han' : '',
                    activeDaiVan ? 'is-dai-van' : '',
                    activeMonth ? 'is-current-month' : '',
                    isSelected ? 'is-selected' : '',
                    showRelations && isTamHop ? 'is-tam-hop' : '',
                    showRelations && isDoiCung ? 'is-doi-cung' : '',
                  ].filter(Boolean).join(' ')}
                  key={index}
                  style={{gridRow:pos.row, gridColumn:pos.col}}
                  onClick={() => setSelectedPalace(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedPalace(index);
                  }}
                  aria-label={`Chọn cung ${palace.Name}`}
                >
                  <div className="relation-corner">
                    {isSelected && <span>ĐANG CHỌN</span>}
                    {!isSelected && showRelations && isTamHop && <span>TAM HỢP</span>}
                    {!isSelected && showRelations && isDoiCung && <span>ĐỐI CUNG</span>}
                  </div>

                  <div className="palace-top">
                    <div className="can-chi-block">
                      <strong>{stem} {branch}</strong>
                      <span>{polarity}{palaceElements[index]}</span>
                    </div>
                    <div className="limit-block">
                      <strong>{majorStart}</strong>
                      <span className={activeMonth ? 'month-badge active' : 'month-badge'}>Th.{monthNo}</span>
                    </div>
                  </div>

                  <div className="palace-title">
                    <h3>{palace.Name || '—'}</h3>
                    <div className="palace-tags">{tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
                  </div>

                  <div className="main-stars">
                    {palace.ChinhTinh.length
                      ? palace.ChinhTinh.map((s, i) => <span key={i}>{s.Name}{s.Status ? ' ('+s.Status+')' : ''}</span>)
                      : <span className="void-main">Vô chính diệu</span>}
                  </div>

                  <div className="star-columns">
                    <div className="star-list good">
                      {palace.Saotot.map((s, i) => <span className={s.Highline ? 'star-strong' : ''} key={i}>{s.Name}{s.Status ? ' ('+s.Status+')' : ''}</span>)}
                    </div>
                    <div className="star-list bad">
                      {palace.Saoxau.map((s, i) => <span className={s.Highline ? 'star-strong' : ''} key={i}>{s.Name}{s.Status ? ' ('+s.Status+')' : ''}</span>)}
                    </div>
                  </div>

                  {annual.annualStars[index].length > 0 && (
                    <div className="annual-list">
                      {annual.annualStars[index].map((name, i) => <span key={i}>{name}</span>)}
                    </div>
                  )}

                  {showTuHoa && [palace.LocNhap,palace.QuyenNhap,palace.KhoaNhap,palace.KyNhap].filter(Boolean).length > 0 && (
                    <div className="transform-list">
                      {[palace.LocNhap,palace.QuyenNhap,palace.KhoaNhap,palace.KyNhap].filter(Boolean).map((name, i) => <span key={i}>{name}</span>)}
                    </div>
                  )}

                  <div className="palace-bottom">
                    <span className="dv-label">{annual.dvLabels[index]}</span>
                    <span className="trang-sinh">{palace.TrangSinh}</span>
                    <span className="ln-label">{annual.lnLabels[index]}</span>
                  </div>

                  <div className="micro-row">
                    <span>TH {annual.tieuHanBranches[index]}</span>
                    {activeTieuHan && <b>TIỂU HẠN {annual.year}</b>}
                    {activeMonth && <b className="month-active-text">THÁNG {annual.month}</b>}
                  </div>
                </article>
              );
            })}

            <article className="center">
              <div className="center-inner">
                <div className="center-kicker">THIÊN BÀN</div>
                <h2>{hideBirthInfo ? 'ĐÃ ẨN THÔNG TIN SINH' : generated.name}</h2>

                {!hideBirthInfo && (
                  <div className="identity-row">
                    <span>{generated.gender === 'female' ? 'NỮ' : 'NAM'}</span>
                    <span>{formatDateDMY(generated.date)}</span>
                    <span>{generated.time}</span>
                  </div>
                )}

                <div className="center-table">
                  <div><small>Âm lịch</small><b>{hideBirthInfo ? '••/•• · ' + chart.Info.Nam : chart.Info.Ngay + '/' + chart.Info.Thang + ' · ' + chart.Info.Nam + ' · giờ ' + chart.Info.Gio}</b></div>
                  <div><small>Âm dương</small><b>{chart.Info.AmDuong} · {annual.amDuongRelation}</b></div>
                  <div><small>Cục</small><b>{chart.Info.Cuc}</b></div>
                  <div><small>Thân cư</small><b>{chart.Info.ThanCu}</b></div>
                  <div><small>Chủ Mệnh</small><b>{chart.Info.ChuMenh}</b></div>
                  <div><small>Chủ Thân</small><b>{chart.Info.ChuThan}</b></div>
                </div>

                <div className="period-grid">
                  <div>
                    <small>ĐẠI VẬN</small>
                    <b>{currentDaiVanPalace?.Name}</b>
                    <span>{annual.majorStartAge[annual.currentDaiVanIndex]}–{annual.majorStartAge[annual.currentDaiVanIndex] + 9} tuổi</span>
                  </div>
                  <div>
                    <small>TIỂU HẠN {annual.year}</small>
                    <b>{currentTieuHanPalace?.Name}</b>
                    <span>{stems[annual.palaceStemIndices[annual.currentTieuHanIndex]]} {branches[annual.currentTieuHanIndex]}</span>
                  </div>
                  <div className="current-month-card">
                    <small>LƯU NGUYỆT · THÁNG {annual.month}</small>
                    <b>{currentMonthPalace?.Name}</b>
                    <span>{stems[annual.palaceStemIndices[annual.currentMonthIndex]]} {branches[annual.currentMonthIndex]}</span>
                  </div>
                </div>

                <div className="month-ring-summary">
                  {Array.from({length:12}, (_,i) => i + 1).map(month => {
                    const palaceIndex = mod(annual.monthOneIndex + month - 1, 12);
                    return (
                      <span className={month === annual.month ? 'active' : ''} key={month}>
                        Th.{month} <b>{branches[palaceIndex]}</b>
                      </span>
                    );
                  })}
                </div>

                <div className="relation-summary">
                  <small>TAM PHƯƠNG TỨ CHÍNH · CUNG ĐANG CHỌN</small>
                  <strong>{selected?.Name} · {stems[annual.palaceStemIndices[selectedPalace]]} {branches[selectedPalace]}</strong>
                  <span>Tam hợp: {tamHopPalaces.map((palace, idx) => `${palace.Name} (${branches[relation.tamHop[idx]]})`).join(' · ')}</span>
                  <span>Đối cung: {doiCungPalace?.Name} ({branches[relation.doiCung]})</span>
                </div>

                <p className="legend">M Miếu · V Vượng · Đ Đắc · B Bình · H Hãm · L. sao lưu · LN. cung lưu niên · TH tiểu hạn</p>
              </div>
            </article>
          </section>
        </div>
      </div>

      {showClickPanel && selected && (
        <section className="selected-panel">
          <div>
            <small>CUNG ĐANG CHỌN</small>
            <h3>{selected.Name} · {stems[annual.palaceStemIndices[selectedPalace]]} {branches[selectedPalace]}</h3>
            <p>{selected.ChinhTinh.length ? selected.ChinhTinh.map(star => star.Name + (star.Status ? ' (' + star.Status + ')' : '')).join(' · ') : 'Vô chính diệu'}</p>
          </div>
          <div>
            <small>TAM PHƯƠNG</small>
            <b>{tamHopPalaces[0]?.Name} ({branches[relation.tamHop[0]]})</b>
            <b>{tamHopPalaces[1]?.Name} ({branches[relation.tamHop[1]]})</b>
          </div>
          <div>
            <small>ĐỐI CUNG</small>
            <b>{doiCungPalace?.Name} ({branches[relation.doiCung]})</b>
          </div>
          <div>
            <small>VẬN HẠN TRÊN CUNG</small>
            <b>{annual.dvLabels[selectedPalace]}</b>
            <b>{annual.lnLabels[selectedPalace]}</b>
            <b>Th.{annual.monthNumbersByPalace[selectedPalace]} · TH {annual.tieuHanBranches[selectedPalace]}</b>
          </div>
          <button onClick={() => setSelectedPalace(getMenhIndex(chart))}>Về cung Mệnh</button>
        </section>
      )}

      <details className="panel json-panel">
        <summary>Dữ liệu tính toán — kiểm tra từng cung / sao / vận / tháng</summary>
        <pre>{JSON.stringify({
          Info: chart.Info,
          Cac_cung: chart.Cac_cung.map((cung, index) => ({
            ...cung,
            CanChiCung: stems[annual.palaceStemIndices[index]] + ' ' + branches[index],
            NguHanhCungText: (index % 2 === 0 ? '+' : '-') + palaceElements[index],
            DaiVan: annual.majorStartAge[index] + '-' + (annual.majorStartAge[index] + 9),
            DaiVanLabel: annual.dvLabels[index],
            LuuNienLabel: annual.lnLabels[index],
            TieuHanChi: annual.tieuHanBranches[index],
            ThangHan: annual.monthNumbersByPalace[index],
            LaTieuHanNamXem: index === annual.currentTieuHanIndex,
            LaThangDangXem: index === annual.currentMonthIndex,
            SaoLuuNam: annual.annualStars[index],
          })),
          Cung_chieu: {
            cung_dang_chon: selected?.Name,
            tam_phuong: relation.tamHop.map(index => chart.Cac_cung[index]?.Name),
            doi_cung: doiCungPalace?.Name,
          },
          Nam_xem: {
            nam: annual.year,
            thang: annual.month,
            can_chi: annual.stem + ' ' + annual.branch,
            tuoi_mu: annual.age,
            dai_van_cung: currentDaiVanPalace?.Name,
            tieu_han_cung: currentTieuHanPalace?.Name,
            luu_nguyet_cung: currentMonthPalace?.Name,
          },
        }, null, 2)}</pre>
      </details>
    </main>
  );
}


const zhGanVi: Record<string,string> = { '甲':'Giáp','乙':'Ất','丙':'Bính','丁':'Đinh','戊':'Mậu','己':'Kỷ','庚':'Canh','辛':'Tân','壬':'Nhâm','癸':'Quý' };
const zhZhiVi: Record<string,string> = { '子':'Tý','丑':'Sửu','寅':'Dần','卯':'Mão','辰':'Thìn','巳':'Tỵ','午':'Ngọ','未':'Mùi','申':'Thân','酉':'Dậu','戌':'Tuất','亥':'Hợi' };
const ganElement: Record<string,string> = { '甲':'Mộc','乙':'Mộc','丙':'Hỏa','丁':'Hỏa','戊':'Thổ','己':'Thổ','庚':'Kim','辛':'Kim','壬':'Thủy','癸':'Thủy' };
const zhiElement: Record<string,string> = { '寅':'Mộc','卯':'Mộc','巳':'Hỏa','午':'Hỏa','申':'Kim','酉':'Kim','亥':'Thủy','子':'Thủy','辰':'Thổ','戌':'Thổ','丑':'Thổ','未':'Thổ' };
const hiddenGan: Record<string,string[]> = { '子':['癸'],'丑':['己','癸','辛'],'寅':['甲','丙','戊'],'卯':['乙'],'辰':['戊','乙','癸'],'巳':['丙','戊','庚'],'午':['丁','己'],'未':['己','丁','乙'],'申':['庚','壬','戊'],'酉':['辛'],'戌':['戊','辛','丁'],'亥':['壬','甲'] };
const yangGan = new Set(['甲','丙','戊','庚','壬']);
const yangZhi = new Set(['子','寅','辰','午','申','戌']);
const tenGodVi: Record<string,string> = { '比肩':'Tỷ Kiên','劫财':'Kiếp Tài','食神':'Thực Thần','伤官':'Thương Quan','正财':'Chính Tài','偏财':'Thiên Tài','正官':'Chính Quan','七杀':'Thất Sát','正印':'Chính Ấn','偏印':'Thiên Ấn','日主':'Nhật chủ' };
const elementOrder = ['Mộc','Hỏa','Thổ','Kim','Thủy'];

function viGanZhi(value: string) {
  if (!value) return '—';
  return value.split('').map(char => zhGanVi[char] || zhZhiVi[char] || char).join(' ');
}

function translateTenGod(value: string) {
  return tenGodVi[value] || value || '—';
}

function emptyElementCounts() {
  return { 'Mộc':0,'Hỏa':0,'Thổ':0,'Kim':0,'Thủy':0 } as Record<string,number>;
}

function countVisibleElements(gans: string[], zhis: string[]) {
  const counts = emptyElementCounts();
  gans.forEach(gan => { const el = ganElement[gan]; if (el) counts[el] += 1; });
  zhis.forEach(zhi => { const el = zhiElement[zhi]; if (el) counts[el] += 1; });
  return counts;
}

function countHiddenElements(zhis: string[]) {
  const counts = emptyElementCounts();
  zhis.flatMap(zhi => hiddenGan[zhi] || []).forEach(gan => { const el = ganElement[gan]; if (el) counts[el] += 1; });
  return counts;
}

function addElementCounts(a: Record<string,number>, b: Record<string,number>) {
  return Object.fromEntries(elementOrder.map(el => [el,(a[el] || 0) + (b[el] || 0)])) as Record<string,number>;
}

function countYinYang(gans: string[], zhis: string[]) {
  let yang = 0;
  gans.forEach(gan => { if (yangGan.has(gan)) yang += 1; });
  zhis.forEach(zhi => { if (yangZhi.has(zhi)) yang += 1; });
  return { yang, yin: gans.length + zhis.length - yang };
}

function countHiddenYinYang(zhis: string[]) {
  const gans = zhis.flatMap(zhi => hiddenGan[zhi] || []);
  const yang = gans.filter(gan => yangGan.has(gan)).length;
  return { yang, yin: gans.length - yang };
}

const trigramByNumber: Record<number,{name:string;element:string;lines:number[]}> = {
  1:{name:'Càn',element:'Kim',lines:[1,1,1]}, 2:{name:'Đoài',element:'Kim',lines:[1,1,0]},
  3:{name:'Ly',element:'Hỏa',lines:[1,0,1]}, 4:{name:'Chấn',element:'Mộc',lines:[1,0,0]},
  5:{name:'Tốn',element:'Mộc',lines:[0,1,1]}, 6:{name:'Khảm',element:'Thủy',lines:[0,1,0]},
  7:{name:'Cấn',element:'Thổ',lines:[0,0,1]}, 8:{name:'Khôn',element:'Thổ',lines:[0,0,0]},
};
const hexagramOmens: Record<string,string> = {
  'Càn Vi Thiên':'Khốn Long Đắc Thủy',
  'Khôn Vi Địa':'Ngạ Hổ Đắc Thực',
  'Thiên Trạch Lý':'Phượng Minh Kỳ Sơn',
  'Thiên Hỏa Đồng Nhân':'Tiên Nhân Chỉ Lộ',
  'Thiên Thủy Tụng':'Nhị Nhân Tranh Lộ',
  'Thiên Địa Bĩ':'Hổ Lạc Hãm Khanh',
  'Lôi Thiên Đại Tráng':'Công Sư Đắc Mộc',
  'Phong Thiên Tiểu Súc':'Mật Vân Bất Vũ',
  'Thủy Thiên Nhu':'Minh Châu Xuất Thổ',
  'Thủy Lôi Truân':'Loạn Ty Vô Đầu',
  'Thủy Địa Tỷ':'Thuyền Đắc Thuận Phong',
  'Sơn Thủy Mông':'Tiểu Quỷ Thâu Tiền',
  'Địa Thiên Thái':'Hỷ Báo Tam Nguyên',
  'Địa Thủy Sư':'Mã Đáo Thành Công',
  'Hỏa Thiên Đại Hữu':'Trảm Thọ Mô Tước',
  'Địa Sơn Khiêm':'Nhị Nhân Phân Kim',
  'Lôi Địa Dự':'Thanh Long Đắc Vị',
  'Trạch Lôi Tùy':'Bộ Bộ Đăng Cao',
  'Sơn Phong Cổ':'Thôi Ma Phần Đạo',
  'Địa Trạch Lâm':'Phát Chánh Thi Nhân',
  'Phong Địa Quán':'Hạn Bồng Phùng Hà',
  'Hỏa Lôi Phệ Hạp':'Cơ Nhân Ngộ Thực',
  'Sơn Hỏa Bí':'Hỷ Khí Doanh Môn',
  'Sơn Địa Bác':'Ưng Thước Đồng Lâm',
  'Địa Lôi Phục':'Phu Thê Phản Phục',
  'Thiên Lôi Vô Vọng':'Điểu Bị Lao Lung',
  'Sơn Thiên Đại Súc':'Trận Thế Đắc Khai',
  'Sơn Lôi Di':'Vị Thủy Phỏng Hiền',
  'Trạch Phong Đại Quá':'Dạ Mộng Kim Ngân',
  'Khảm Vi Thủy':'Thủy Để Lao Nguyệt',
  'Ly Vi Hỏa':'Thiên Quan Tứ Phước',
  'Trạch Sơn Hàm':'Manh Nha Xuất Thổ',
  'Lôi Phong Hằng':'Ngư Lai Tràng Võng',
  'Thiên Sơn Độn':'Nùng Vân Tế Nhật',
  'Hỏa Địa Tấn':'Sừ Địa Đắc Kim',
  'Địa Hỏa Minh Di':'Quá Giang Chiết Kiều',
  'Phong Hỏa Gia Nhân':'Cảnh Lý Quan Hoa',
  'Hỏa Trạch Khuê':'Phản Mại Trư Dương',
  'Thủy Sơn Kiển':'Vũ Tuyết Tải Đồ',
  'Lôi Thủy Giải':'Ngũ Quan Thoát Nạn',
  'Sơn Trạch Tổn':'Thôi Xa Phí Lực',
  'Phong Lôi Ích':'Khô Mộc Khai Hoa',
  'Trạch Thiên Quải':'Du Phong Thoát Võng',
  'Thiên Phong Cấu':'Tha Hương Ngộ Hữu',
  'Trạch Địa Tụy':'Ngư Lý Hóa Long',
  'Địa Phong Thăng':'Chỉ Nhật Cao Thăng',
  'Trạch Thủy Khốn':'Thoát Lãng Trừu Đê',
  'Thủy Phong Tỉnh':'Khô Tỉnh Sinh Tuyền',
  'Trạch Hỏa Cách':'Hạn Miêu Đắc Vũ',
  'Hỏa Phong Đỉnh':'Ngư Ông Đắc Lợi',
  'Chấn Vi Lôi':'Kim Chung Dạ Tràng',
  'Cấn Vi Sơn':'Nhân Đoản Táo Cao',
  'Phong Sơn Tiệm':'Tuấn Mã Xuất Lung',
  'Lôi Trạch Quy Muội':'Duyên Mộc Cầu Ngư',
  'Lôi Hỏa Phong':'Cổ Kính Trùng Minh',
  'Hỏa Sơn Lữ':'Túc Điểu Phần Sào',
  'Tốn Vi Phong':'Châu Đắc Thuận Phong',
  'Đoài Vi Trạch':'Chẩn Thủy Hòa Nê',
  'Phong Thủy Hoán':'Cách Hà Vọng Kim',
  'Thủy Trạch Tiết':'Trảm Tướng Phong Thần',
  'Phong Trạch Trung Phu':'Hành Tẩu Bạc Băng',
  'Lôi Sơn Tiểu Quá':'Cấp Quá Độc Kiều',
  'Thủy Hỏa Ký Tế':'Kim Bảng Đề Danh',
  'Hỏa Thủy Vị Tế':'Thái Tuế Nguyệt Kiến',
};

const hexagramNames: Record<string,string> = {
  'Càn|Càn':'Càn Vi Thiên','Càn|Đoài':'Thiên Trạch Lý','Càn|Ly':'Thiên Hỏa Đồng Nhân','Càn|Chấn':'Thiên Lôi Vô Vọng','Càn|Tốn':'Thiên Phong Cấu','Càn|Khảm':'Thiên Thủy Tụng','Càn|Cấn':'Thiên Sơn Độn','Càn|Khôn':'Thiên Địa Bĩ',
  'Đoài|Càn':'Trạch Thiên Quải','Đoài|Đoài':'Đoài Vi Trạch','Đoài|Ly':'Trạch Hỏa Cách','Đoài|Chấn':'Trạch Lôi Tùy','Đoài|Tốn':'Trạch Phong Đại Quá','Đoài|Khảm':'Trạch Thủy Khốn','Đoài|Cấn':'Trạch Sơn Hàm','Đoài|Khôn':'Trạch Địa Tụy',
  'Ly|Càn':'Hỏa Thiên Đại Hữu','Ly|Đoài':'Hỏa Trạch Khuê','Ly|Ly':'Ly Vi Hỏa','Ly|Chấn':'Hỏa Lôi Phệ Hạp','Ly|Tốn':'Hỏa Phong Đỉnh','Ly|Khảm':'Hỏa Thủy Vị Tế','Ly|Cấn':'Hỏa Sơn Lữ','Ly|Khôn':'Hỏa Địa Tấn',
  'Chấn|Càn':'Lôi Thiên Đại Tráng','Chấn|Đoài':'Lôi Trạch Quy Muội','Chấn|Ly':'Lôi Hỏa Phong','Chấn|Chấn':'Chấn Vi Lôi','Chấn|Tốn':'Lôi Phong Hằng','Chấn|Khảm':'Lôi Thủy Giải','Chấn|Cấn':'Lôi Sơn Tiểu Quá','Chấn|Khôn':'Lôi Địa Dự',
  'Tốn|Càn':'Phong Thiên Tiểu Súc','Tốn|Đoài':'Phong Trạch Trung Phu','Tốn|Ly':'Phong Hỏa Gia Nhân','Tốn|Chấn':'Phong Lôi Ích','Tốn|Tốn':'Tốn Vi Phong','Tốn|Khảm':'Phong Thủy Hoán','Tốn|Cấn':'Phong Sơn Tiệm','Tốn|Khôn':'Phong Địa Quán',
  'Khảm|Càn':'Thủy Thiên Nhu','Khảm|Đoài':'Thủy Trạch Tiết','Khảm|Ly':'Thủy Hỏa Ký Tế','Khảm|Chấn':'Thủy Lôi Truân','Khảm|Tốn':'Thủy Phong Tỉnh','Khảm|Khảm':'Khảm Vi Thủy','Khảm|Cấn':'Thủy Sơn Kiển','Khảm|Khôn':'Thủy Địa Tỷ',
  'Cấn|Càn':'Sơn Thiên Đại Súc','Cấn|Đoài':'Sơn Trạch Tổn','Cấn|Ly':'Sơn Hỏa Bí','Cấn|Chấn':'Sơn Lôi Di','Cấn|Tốn':'Sơn Phong Cổ','Cấn|Khảm':'Sơn Thủy Mông','Cấn|Cấn':'Cấn Vi Sơn','Cấn|Khôn':'Sơn Địa Bác',
  'Khôn|Càn':'Địa Thiên Thái','Khôn|Đoài':'Địa Trạch Lâm','Khôn|Ly':'Địa Hỏa Minh Di','Khôn|Chấn':'Địa Lôi Phục','Khôn|Tốn':'Địa Phong Thăng','Khôn|Khảm':'Địa Thủy Sư','Khôn|Cấn':'Địa Sơn Khiêm','Khôn|Khôn':'Khôn Vi Địa',
};

function cycleRemainder(value: number, modulo: number) {
  const remainder = Math.abs(Math.trunc(value)) % modulo;
  return remainder === 0 ? modulo : remainder;
}

function trigramNumberFromLines(lines: number[]) {
  const found = Object.entries(trigramByNumber).find(([,trigram]) => trigram.lines.join('') === lines.join(''));
  return found ? Number(found[0]) : 8;
}

type IChingResult = {
  upper:{name:string;element:string;lines:number[]};
  lower:{name:string;element:string;lines:number[]};
  lines:number[];
  movingLines:number[];
  name:string;
  mutualLines:number[];
  mutualName:string;
  changedLines:number[];
  changedName:string;
};

function makeHexagramFromLines(lines:number[], movingLines:number[]): IChingResult {
  const lowerNo = trigramNumberFromLines(lines.slice(0,3));
  const upperNo = trigramNumberFromLines(lines.slice(3,6));
  const upper = trigramByNumber[upperNo];
  const lower = trigramByNumber[lowerNo];
  const mutualLowerLines = [lines[1],lines[2],lines[3]];
  const mutualUpperLines = [lines[2],lines[3],lines[4]];
  const mutualLower = trigramByNumber[trigramNumberFromLines(mutualLowerLines)];
  const mutualUpper = trigramByNumber[trigramNumberFromLines(mutualUpperLines)];
  const mutualLines = [...mutualLowerLines,...mutualUpperLines];
  const changedLines = lines.map((line,index) => movingLines.includes(index + 1) ? (line ? 0 : 1) : line);
  const changedLower = trigramByNumber[trigramNumberFromLines(changedLines.slice(0,3))];
  const changedUpper = trigramByNumber[trigramNumberFromLines(changedLines.slice(3,6))];
  return {
    upper,
    lower,
    lines,
    movingLines,
    name: hexagramNames[`${upper.name}|${lower.name}`] || `${upper.name} / ${lower.name}`,
    mutualLines,
    mutualName: hexagramNames[`${mutualUpper.name}|${mutualLower.name}`] || `${mutualUpper.name} / ${mutualLower.name}`,
    changedLines,
    changedName: hexagramNames[`${changedUpper.name}|${changedLower.name}`] || `${changedUpper.name} / ${changedLower.name}`,
  };
}

function makeHexagram(upperNo:number, lowerNo:number, movingLine:number) {
  return makeHexagramFromLines([...trigramByNumber[lowerNo].lines,...trigramByNumber[upperNo].lines],[movingLine]);
}

function HexagramLines({ lines, movingLines = [] }: { lines:number[]; movingLines?:number[] }) {
  return <div className="hex-lines">{[...lines].map((line,index) => ({line,index})).reverse().map(({line,index}) => <div className={movingLines.includes(index + 1) ? 'hex-line moving' : 'hex-line'} key={index}><span className={line ? 'yang-line' : 'yin-line'}>{line ? <i/> : <><i/><i/></>}</span>{movingLines.includes(index + 1) && <b>hào {index + 1}</b>}</div>)}</div>;
}

type IChingCastMeta = {
  method:string;
  solarText:string;
  lunarText:string;
  canChi:string;
  jieQi:string;
  daySpirit:string;
  monthCommand:string;
  monthMode:string;
  dayGan:string;
  dayZhi:string;
  monthZhi:string;
};

const jieQiVi: Record<string,string> = {
  '立春':'Lập Xuân','雨水':'Vũ Thủy','惊蛰':'Kinh Trập','驚蟄':'Kinh Trập','春分':'Xuân Phân','清明':'Thanh Minh','谷雨':'Cốc Vũ','穀雨':'Cốc Vũ',
  '立夏':'Lập Hạ','小满':'Tiểu Mãn','小滿':'Tiểu Mãn','芒种':'Mang Chủng','芒種':'Mang Chủng','夏至':'Hạ Chí','小暑':'Tiểu Thử','大暑':'Đại Thử',
  '立秋':'Lập Thu','处暑':'Xử Thử','處暑':'Xử Thử','白露':'Bạch Lộ','秋分':'Thu Phân','寒露':'Hàn Lộ','霜降':'Sương Giáng',
  '立冬':'Lập Đông','小雪':'Tiểu Tuyết','大雪':'Đại Tuyết','冬至':'Đông Chí','小寒':'Tiểu Hàn','大寒':'Đại Hàn',
};

function buildIChingMeta(date:string,time:string,method:string,useJieQi:boolean): IChingCastMeta {
  const [year,month,day] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  const lunar = Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar();
  const eight = lunar.getEightChar();
  const prevJieQi = lunar.getPrevJieQi(false);
  const jieQiRaw = prevJieQi?.getName?.() || lunar.getJieQi?.() || '—';
  const lunarMonth = Math.abs(lunar.getMonth());
  const leap = lunar.getMonth() < 0 ? ' nhuận' : '';
  const dayZhi = eight.getDayZhi();
  const lunarMonthBranches = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const monthZhi = useJieQi ? eight.getMonthZhi() : lunarMonthBranches[(lunarMonth - 1) % 12];
  const monthText = useJieQi ? `tháng ${viGanZhi(eight.getMonth())}` : `tháng âm ${lunarMonth}${leap} (${zhZhiVi[monthZhi] || monthZhi})`;
  return {
    method,
    solarText:`${formatDateDMY(date)} · ${time}`,
    lunarText:`${lunar.getDay()}/${lunarMonth}/${lunar.getYear()} âm lịch${leap}`,
    canChi:`Giờ ${viGanZhi(eight.getTime())} · ngày ${viGanZhi(eight.getDay())} · ${monthText} · năm ${viGanZhi(eight.getYear())}`,
    jieQi:useJieQi ? (jieQiVi[jieQiRaw] || jieQiRaw) : 'Không áp dụng',
    daySpirit:`${zhZhiVi[dayZhi] || dayZhi}-${zhiElement[dayZhi] || '—'}`,
    monthCommand:`${zhZhiVi[monthZhi] || monthZhi}-${zhiElement[monthZhi] || '—'}`,
    monthMode:useJieQi ? 'Theo tiết khí' : 'Theo tháng âm lịch',
    dayGan:eight.getDayGan(),
    dayZhi,
    monthZhi,
  };
}

type LiuYaoLine = {
  index:number;
  yinYang:number;
  stem:string;
  branch:string;
  element:string;
  relation:string;
  shiYing:string;
  sixSpirit:string;
  empty:boolean;
  strength:string;
  hidden:string;
  guaBody:boolean;
  lu:boolean;
  horse:boolean;
  noble:boolean;
  peach:boolean;
};

type HexPalace = { palace:string; element:string; order:number; stage:string; shi:number; ying:number; tag:string };

const liuYaoPalaces: Array<{ palace:string; element:string; names:string[] }> = [
  { palace:'Càn', element:'Kim', names:['Càn Vi Thiên','Thiên Phong Cấu','Thiên Sơn Độn','Thiên Địa Bĩ','Phong Địa Quán','Sơn Địa Bác','Hỏa Địa Tấn','Hỏa Thiên Đại Hữu'] },
  { palace:'Đoài', element:'Kim', names:['Đoài Vi Trạch','Trạch Thủy Khốn','Trạch Địa Tụy','Trạch Sơn Hàm','Thủy Sơn Kiển','Địa Sơn Khiêm','Lôi Sơn Tiểu Quá','Lôi Trạch Quy Muội'] },
  { palace:'Ly', element:'Hỏa', names:['Ly Vi Hỏa','Hỏa Sơn Lữ','Hỏa Phong Đỉnh','Hỏa Thủy Vị Tế','Sơn Thủy Mông','Phong Thủy Hoán','Thiên Thủy Tụng','Thiên Hỏa Đồng Nhân'] },
  { palace:'Chấn', element:'Mộc', names:['Chấn Vi Lôi','Lôi Địa Dự','Lôi Thủy Giải','Lôi Phong Hằng','Địa Phong Thăng','Thủy Phong Tỉnh','Trạch Phong Đại Quá','Trạch Lôi Tùy'] },
  { palace:'Tốn', element:'Mộc', names:['Tốn Vi Phong','Phong Thiên Tiểu Súc','Phong Hỏa Gia Nhân','Phong Lôi Ích','Thiên Lôi Vô Vọng','Hỏa Lôi Phệ Hạp','Sơn Lôi Di','Sơn Phong Cổ'] },
  { palace:'Khảm', element:'Thủy', names:['Khảm Vi Thủy','Thủy Trạch Tiết','Thủy Lôi Truân','Thủy Hỏa Ký Tế','Trạch Hỏa Cách','Lôi Hỏa Phong','Địa Hỏa Minh Di','Địa Thủy Sư'] },
  { palace:'Cấn', element:'Thổ', names:['Cấn Vi Sơn','Sơn Hỏa Bí','Sơn Thiên Đại Súc','Sơn Trạch Tổn','Hỏa Trạch Khuê','Thiên Trạch Lý','Phong Trạch Trung Phu','Phong Sơn Tiệm'] },
  { palace:'Khôn', element:'Thổ', names:['Khôn Vi Địa','Địa Lôi Phục','Địa Trạch Lâm','Địa Thiên Thái','Lôi Thiên Đại Tráng','Trạch Thiên Quải','Thủy Thiên Nhu','Thủy Địa Tỷ'] },
];

const liuYaoStages = ['Bản cung','Nhất thế','Nhị thế','Tam thế','Tứ thế','Ngũ thế','Du hồn','Quy hồn'];
const liuYaoShiByOrder = [6,1,2,3,4,5,4,3];
const liuYaoSixClash = new Set(['Càn Vi Thiên','Khôn Vi Địa','Khảm Vi Thủy','Ly Vi Hỏa','Chấn Vi Lôi','Cấn Vi Sơn','Tốn Vi Phong','Đoài Vi Trạch','Lôi Thiên Đại Tráng','Thiên Lôi Vô Vọng']);
const liuYaoSixHarmony = new Set(['Thiên Địa Bĩ','Địa Thiên Thái','Địa Lôi Phục','Lôi Địa Dự','Sơn Hỏa Bí','Hỏa Sơn Lữ','Thủy Trạch Tiết','Trạch Thủy Khốn']);

const naJiaByTrigram: Record<string,{ innerStem:string; outerStem:string; branches:string[] }> = {
  'Càn':{innerStem:'甲',outerStem:'壬',branches:['子','寅','辰','午','申','戌']},
  'Đoài':{innerStem:'丁',outerStem:'丁',branches:['巳','卯','丑','亥','酉','未']},
  'Ly':{innerStem:'己',outerStem:'己',branches:['卯','丑','亥','酉','未','巳']},
  'Chấn':{innerStem:'庚',outerStem:'庚',branches:['子','寅','辰','午','申','戌']},
  'Tốn':{innerStem:'辛',outerStem:'辛',branches:['丑','亥','酉','未','巳','卯']},
  'Khảm':{innerStem:'戊',outerStem:'戊',branches:['寅','辰','午','申','戌','子']},
  'Cấn':{innerStem:'丙',outerStem:'丙',branches:['辰','午','申','戌','子','寅']},
  'Khôn':{innerStem:'乙',outerStem:'癸',branches:['未','巳','卯','丑','亥','酉']},
};

const elementGenerates: Record<string,string> = { 'Mộc':'Hỏa','Hỏa':'Thổ','Thổ':'Kim','Kim':'Thủy','Thủy':'Mộc' };
const elementControls: Record<string,string> = { 'Mộc':'Thổ','Thổ':'Thủy','Thủy':'Hỏa','Hỏa':'Kim','Kim':'Mộc' };
const sixSpiritCycle = ['Thanh Long','Chu Tước','Câu Trần','Đằng Xà','Bạch Hổ','Huyền Vũ'];
const stemsZh = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const branchesZh = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function getHexPalace(name:string): HexPalace {
  for (const group of liuYaoPalaces) {
    const order = group.names.indexOf(name);
    if (order >= 0) {
      const shi = liuYaoShiByOrder[order];
      const ying = ((shi + 2) % 6) + 1;
      return { palace:group.palace, element:group.element, order, stage:liuYaoStages[order], shi, ying, tag:liuYaoSixClash.has(name) ? 'Lục xung' : liuYaoSixHarmony.has(name) ? 'Lục hợp' : '' };
    }
  }
  return { palace:'—',element:'—',order:0,stage:'—',shi:6,ying:3,tag:'' };
}

function relationFromElements(palaceElement:string,lineElement:string) {
  if (palaceElement === lineElement) return 'Huynh Đệ';
  if (elementGenerates[lineElement] === palaceElement) return 'Phụ Mẫu';
  if (elementGenerates[palaceElement] === lineElement) return 'Tử Tôn';
  if (elementControls[palaceElement] === lineElement) return 'Thê Tài';
  if (elementControls[lineElement] === palaceElement) return 'Quan Quỷ';
  return '—';
}

function strengthByMonth(monthElement:string,lineElement:string) {
  if (monthElement === lineElement) return 'Vượng';
  if (elementGenerates[monthElement] === lineElement) return 'Tướng';
  if (elementGenerates[lineElement] === monthElement) return 'Hưu';
  if (elementControls[lineElement] === monthElement) return 'Tù';
  if (elementControls[monthElement] === lineElement) return 'Tử';
  return '—';
}

function xunKongBranches(dayGan:string,dayZhi:string) {
  let index = -1;
  for (let i = 0; i < 60; i += 1) if (stemsZh[i % 10] === dayGan && branchesZh[i % 12] === dayZhi) { index = i; break; }
  if (index < 0) return [] as string[];
  return [['戌','亥'],['申','酉'],['午','未'],['辰','巳'],['寅','卯'],['子','丑']][Math.floor(index / 10)];
}

function sixSpirits(dayGan:string) {
  const start = ['甲','乙'].includes(dayGan) ? 0 : ['丙','丁'].includes(dayGan) ? 1 : dayGan === '戊' ? 2 : dayGan === '己' ? 3 : ['庚','辛'].includes(dayGan) ? 4 : 5;
  return Array.from({length:6},(_,index) => sixSpiritCycle[(start + index) % 6]);
}

function shenShaForDay(dayGan:string,dayZhi:string) {
  const lu:Record<string,string> = {甲:'寅',乙:'卯',丙:'巳',戊:'巳',丁:'午',己:'午',庚:'申',辛:'酉',壬:'亥',癸:'子'};
  const horse = ['申','子','辰'].includes(dayZhi) ? '寅' : ['寅','午','戌'].includes(dayZhi) ? '申' : ['巳','酉','丑'].includes(dayZhi) ? '亥' : '巳';
  const peach = ['申','子','辰'].includes(dayZhi) ? '酉' : ['寅','午','戌'].includes(dayZhi) ? '卯' : ['巳','酉','丑'].includes(dayZhi) ? '午' : '子';
  const noble:Record<string,string[]> = {甲:['丑','未'],戊:['丑','未'],庚:['丑','未'],乙:['子','申'],己:['子','申'],丙:['亥','酉'],丁:['亥','酉'],壬:['巳','卯'],癸:['巳','卯'],辛:['寅','午']};
  return { lu:lu[dayGan] || '', horse, peach, noble:noble[dayGan] || [] };
}

function naJiaForHex(lines:number[]) {
  const lowerName = trigramByNumber[trigramNumberFromLines(lines.slice(0,3))].name;
  const upperName = trigramByNumber[trigramNumberFromLines(lines.slice(3,6))].name;
  const lower = naJiaByTrigram[lowerName];
  const upper = naJiaByTrigram[upperName];
  return Array.from({length:6},(_,index) => index < 3 ? { stem:lower.innerStem, branch:lower.branches[index] } : { stem:upper.outerStem, branch:upper.branches[index] });
}

function hiddenSpiritsForHex(name:string,currentRelations:string[]) {
  const palace = getHexPalace(name);
  const group = liuYaoPalaces.find(item => item.palace === palace.palace);
  if (!group) return Array(6).fill('');
  const missing = new Set(['Phụ Mẫu','Huynh Đệ','Tử Tôn','Thê Tài','Quan Quỷ'].filter(relation => !currentRelations.includes(relation)));
  if (!missing.size) return Array(6).fill('');
  const pureName = group.names[0];
  const pureLines = Object.values(trigramByNumber).find(item => item.name === palace.palace)?.lines || [1,1,1];
  const pureNaJia = naJiaForHex([...pureLines,...pureLines]);
  const hidden = Array(6).fill('');
  pureNaJia.forEach((item,index) => {
    const element = zhiElement[item.branch] || '—';
    const relation = relationFromElements(palace.element,element);
    if (missing.has(relation)) hidden[index] = `${relation} ${zhGanVi[item.stem] || item.stem} ${zhZhiVi[item.branch] || item.branch}-${element}`;
  });
  void pureName;
  return hidden;
}

function buildLiuYaoLines(result:IChingResult,meta:IChingCastMeta) {
  const mainPalace = getHexPalace(result.name);
  const empty = xunKongBranches(meta.dayGan,meta.dayZhi);
  const spirits = sixSpirits(meta.dayGan);
  const shenSha = shenShaForDay(meta.dayGan,meta.dayZhi);
  const monthElement = zhiElement[meta.monthZhi] || '—';
  const mainNaJia = naJiaForHex(result.lines);
  const mainRelations = mainNaJia.map(item => relationFromElements(mainPalace.element,zhiElement[item.branch] || '—'));
  const hidden = hiddenSpiritsForHex(result.name,mainRelations);
  const shiYang = result.lines[mainPalace.shi - 1] === 1;
  const guaBodyBranch = (shiYang ? ['子','丑','寅','卯','辰','巳'] : ['午','未','申','酉','戌','亥'])[mainPalace.shi - 1];
  const mapLines = (lines:number[],useHidden:boolean) => {
    const naJia = naJiaForHex(lines);
    return naJia.map((item,index):LiuYaoLine => {
      const element = zhiElement[item.branch] || '—';
      return {
        index:index + 1,
        yinYang:lines[index],
        stem:item.stem,
        branch:item.branch,
        element,
        relation:relationFromElements(mainPalace.element,element),
        shiYing:index + 1 === mainPalace.shi ? 'Thế' : index + 1 === mainPalace.ying ? 'Ứng' : '',
        sixSpirit:spirits[index],
        empty:empty.includes(item.branch),
        strength:strengthByMonth(monthElement,element),
        hidden:useHidden ? hidden[index] : '',
        guaBody:item.branch === guaBodyBranch,
        lu:item.branch === shenSha.lu,
        horse:item.branch === shenSha.horse,
        noble:shenSha.noble.includes(item.branch),
        peach:item.branch === shenSha.peach,
      };
    });
  };
  return {
    mainPalace,
    mutualPalace:getHexPalace(result.mutualName),
    changedPalace:getHexPalace(result.changedName),
    main:mapLines(result.lines,true),
    changed:mapLines(result.changedLines,false),
    empty,
    guaBodyBranch,
  };
}

function MiniYao({ line,moving=false }:{ line:number; moving?:boolean }) {
  return <span className={moving ? 'mini-yao moving' : 'mini-yao'}>{line ? <i/> : <><i/><i/></>}</span>;
}

function LiuYaoDetail({ result,meta }:{ result:IChingResult; meta:IChingCastMeta }) {
  const detail = buildLiuYaoLines(result,meta);
  const topMain = [...detail.main].reverse();
  const topChanged = [...detail.changed].reverse();
  return <section className="liuyao-panel">
    <div className="liuyao-headline"><div><span>{hexagramOmens[result.name] || result.name}</span><b>Họ {detail.mainPalace.palace} · {detail.mainPalace.stage}{detail.mainPalace.tag ? ' · ' + detail.mainPalace.tag : ''}</b></div><div><span>{hexagramOmens[result.changedName] || result.changedName}</span><b>Họ {detail.changedPalace.palace} · {detail.changedPalace.stage}{detail.changedPalace.tag ? ' · ' + detail.changedPalace.tag : ''}</b></div></div>
    <div className="liuyao-table liuyao-primary-table">
      <div className="ly-row ly-header"><b>Hào</b><b>T/Ứ</b><b>Lục Thân</b><b>Can Chi</b><b>Phục thần</b><b>TK</b><b>Lục Thân biến</b><b>Can Chi biến</b><b>TK</b><b>Lục Thú</b><b>Hào</b></div>
      {topMain.map((line,rowIndex) => {
        const changed = topChanged[rowIndex];
        const isMoving = result.movingLines.includes(line.index);
        return <div className={isMoving ? 'ly-row is-moving' : 'ly-row'} key={line.index}>
          <span><MiniYao line={line.yinYang} moving={isMoving}/></span>
          <strong>{line.shiYing || '—'}</strong>
          <span>{line.relation}</span>
          <span>{zhZhiVi[line.branch] || line.branch}-{line.element}</span>
          <small>{line.hidden || '—'}</small>
          <b>{line.empty ? 'K' : '—'}</b>
          <span>{changed.relation}</span>
          <span>{zhZhiVi[changed.branch] || changed.branch}-{changed.element}</span>
          <b>{changed.empty ? 'K' : '—'}</b>
          <span>{changed.sixSpirit}</span>
          <span><MiniYao line={changed.yinYang} moving={isMoving}/></span>
        </div>;
      })}
    </div>
    <div className="liuyao-secondary-grid">
      {[{title:'QUẺ CHỦ',lines:detail.main},{title:'QUẺ BIẾN',lines:detail.changed}].map(block => <div className="liuyao-secondary" key={block.title}><div className="ly2-row ly2-head"><b>Hào</b><b>V-S</b><b>Quái thân</b><b>Lộc</b><b>Mã</b><b>Quý</b><b>Đào</b></div>{[...block.lines].reverse().map(line => <div className="ly2-row" key={line.index}><span>{zhGanVi[line.stem] || line.stem} {zhZhiVi[line.branch] || line.branch}</span><span>{line.strength}</span><span>{line.guaBody ? 'Thân' : '—'}</span><span>{line.lu ? 'L' : '—'}</span><span>{line.horse ? 'M' : '—'}</span><span>{line.noble ? 'Q' : '—'}</span><span>{line.peach ? 'Đ' : '—'}</span></div>)}</div>)}
    </div>
    <div className="liuyao-footnote"><strong>Tuần Không:</strong> {detail.empty.length ? detail.empty.map(item => zhZhiVi[item] || item).join(' · ') : '—'} · <strong>Quái thân:</strong> {zhZhiVi[detail.guaBodyBranch] || detail.guaBodyBranch}. <span>Lục Thân của quẻ biến tiếp tục lấy ngũ hành Họ quẻ chủ làm chuẩn.</span></div>
  </section>;
}

function serialCast(raw:string) {
  const digits = raw.replace(/\D/g,'');
  if (digits.length !== 8) throw new Error('Serial tiền phải có đúng 8 chữ số. Có thể dán cả tiền tố chữ, hệ thống chỉ lấy 8 số theo thứ tự.');
  const values = digits.split('').map(Number);
  const upperSeed = values.slice(0,4).reduce((sum,value) => sum + value,0);
  const lowerSeed = values.slice(4).reduce((sum,value) => sum + value,0);
  const movingSeed = values.reduce((sum,value) => sum + value,0);
  return {
    result:makeHexagram(cycleRemainder(upperSeed,8),cycleRemainder(lowerSeed,8),cycleRemainder(movingSeed,6)),
    trace:`${digits.slice(0,4)} → tổng ${upperSeed} → Thượng quái; ${digits.slice(4)} → tổng ${lowerSeed} → Hạ quái; tổng 8 số ${movingSeed} → hào động`,
  };
}

function timeCast(date:string,time:string) {
  const [year,month,day] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  const lunar = Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar();
  const yearNo = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(lunar.getYearZhiExact()) + 1;
  const hourNo = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(lunar.getTimeZhi()) + 1;
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const base = yearNo + lunarMonth + lunarDay;
  return {
    result:makeHexagram(cycleRemainder(base,8),cycleRemainder(base + hourNo,8),cycleRemainder(base + hourNo,6)),
    trace:`Âm lịch: ngày ${lunarDay} + tháng ${lunarMonth} + số Chi năm ${yearNo} = ${base}; cộng số Chi giờ ${hourNo} để lập Hạ quái và hào động`,
  };
}

function yarrowCast() {
  const values = Array.from({length:6},() => {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const bucket = Math.floor(random[0] / 4294967296 * 16);
    if (bucket < 1) return 6;
    if (bucket < 6) return 7;
    if (bucket < 13) return 8;
    return 9;
  });
  const lines = values.map(value => value === 7 || value === 9 ? 1 : 0);
  const movingLines = values.map((value,index) => value === 6 || value === 9 ? index + 1 : 0).filter(Boolean);
  return {
    result:makeHexagramFromLines(lines,movingLines),
    trace:`Giả lập Cỏ thi 49 stalks · sáu hào từ Sơ lên Thượng: ${values.join(' · ')} · hào động ${movingLines.length ? movingLines.join(', ') : 'không có'}`,
  };
}

function birthCast(date:string,time:string,calendar:'solar'|'lunar',isLeapMonth:boolean,useJieQi:boolean) {
  const [year,month,day] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  const lunar = calendar === 'solar' ? Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar() : Lunar.fromYmdHms(year,isLeapMonth ? -month : month,day,hour,minute,0);
  const yearNo = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(lunar.getYearZhiExact()) + 1;
  const hourNo = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(lunar.getTimeZhi()) + 1;
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const base = yearNo + lunarMonth + lunarDay;
  const solar = lunar.getSolar();
  const solarDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2,'0')}-${String(solar.getDay()).padStart(2,'0')}`;
  return {
    result:makeHexagram(cycleRemainder(base,8),cycleRemainder(base + hourNo,8),cycleRemainder(base + hourNo,6)),
    trace:`Ngày âm ${lunarDay} + tháng âm ${lunarMonth} + số Chi năm ${yearNo} = ${base}; cộng số Chi giờ ${hourNo} để lập Hạ quái và hào động`,
    meta:buildIChingMeta(solarDate,time,'Quẻ số mệnh theo ngày tháng năm sinh',useJieQi),
  };
}

function IChingPage() {
  const defaultCastMoment = useRef((() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString();
    return { date:local.slice(0,10), time:local.slice(11,16) };
  })()).current;
  const [method,setMethod] = useState<'serial'|'time'|'random'|'birth'>('serial');
  const [question,setQuestion] = useState('');
  const [casterName,setCasterName] = useState('');
  const [serial,setSerial] = useState('');
  const [motionDate,setMotionDate] = useState(defaultCastMoment.date);
  const [motionTime,setMotionTime] = useState(defaultCastMoment.time);
  const [birthDate,setBirthDate] = useState('');
  const [birthTime,setBirthTime] = useState('');
  const [birthCalendar,setBirthCalendar] = useState<'solar'|'lunar'>('solar');
  const [birthLeap,setBirthLeap] = useState(false);
  const [useJieQi,setUseJieQi] = useState(true);
  const [result,setResult] = useState<IChingResult | null>(null);
  const [meta,setMeta] = useState<IChingCastMeta | null>(null);
  const [castNote,setCastNote] = useState('');
  const [error,setError] = useState('');
  const [downloading,setDownloading] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  function changeMethod(next:'serial'|'time'|'random'|'birth') {
    setMethod(next);
    setResult(null);
    setMeta(null);
    setCastNote('');
    setError('');
  }

  function cast() {
    try {
      if (method !== 'birth' && !question.trim()) throw new Error('Nhập việc cần xem trước khi lập quẻ hỏi việc.');
      if (method === 'serial') {
        if (!motionDate || !motionTime) throw new Error('Lập quẻ bằng Serial tiền bắt buộc có ngày và giờ động tâm.');
        const casted = serialCast(serial);
        setResult(casted.result);
        setMeta(buildIChingMeta(motionDate,motionTime,'Lập quẻ bằng Serial tiền',useJieQi));
        setCastNote(casted.trace);
      } else if (method === 'time') {
        if (!motionDate || !motionTime) throw new Error('Nhập đủ ngày và giờ động tâm.');
        const casted = timeCast(motionDate,motionTime);
        setResult(casted.result);
        setMeta(buildIChingMeta(motionDate,motionTime,'Mai Hoa theo thời gian động tâm',useJieQi));
        setCastNote(casted.trace);
      } else if (method === 'random') {
        if (!motionDate || !motionTime) throw new Error('Quẻ ngẫu nhiên vẫn phải ghi ngày và giờ động tâm.');
        const casted = yarrowCast();
        setResult(casted.result);
        setMeta(buildIChingMeta(motionDate,motionTime,'Quẻ ngẫu nhiên · giả lập phương pháp Bói Cỏ thi',useJieQi));
        setCastNote(casted.trace);
      } else {
        if (!birthDate || !birthTime) throw new Error('Nhập đủ ngày sinh và giờ sinh.');
        const casted = birthCast(birthDate,birthTime,birthCalendar,birthLeap,useJieQi);
        setResult(casted.result);
        setMeta(casted.meta);
        setCastNote(casted.trace);
      }
      setError('');
    } catch (err) {
      setResult(null);
      setMeta(null);
      setCastNote('');
      setError(err instanceof Error ? err.message : 'Không thể lập quẻ.');
    }
  }

  async function downloadQuaiImage() {
    if (!result || !meta || !exportRef.current || downloading) return;
    try {
      setDownloading(true);
      const node = exportRef.current;
      const dataUrl = await toPng(node,{
        cacheBust:true,
        pixelRatio:2,
        backgroundColor:'#fbf7ee',
        width:node.scrollWidth,
        height:node.scrollHeight,
      });
      const safeQuestion = (method === 'birth' ? (casterName || 'que-so-menh') : (question || result.name))
        .trim()
        .replace(/[^a-zA-Z0-9À-ỹ]+/g,'-')
        .replace(/^-|-$/g,'')
        .slice(0,70) || 'que-kinh-dich';
      const link = document.createElement('a');
      link.download = `${safeQuestion}-${meta.solarText.replace(/[^0-9]+/g,'-').replace(/^-|-$/g,'')}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError('Không thể xuất ảnh quẻ. Hãy thử lại một lần nữa.');
    } finally {
      setDownloading(false);
    }
  }

  const movingText = result?.movingLines.length ? `Hào động: ${result.movingLines.join(', ')}` : 'Không có hào động';

  return <main className="workspace module-page">
    <header className="module-header">
      <p className="eyebrow">KINH DỊCH · DỊCH QUÁI</p>
      <h1>Lập quẻ Kinh Dịch</h1>
      <p>Tách rõ từng phương pháp. Kết quả gồm Quẻ chủ · Quẻ hỗ · Quẻ biến và bàn Lục Hào/Nạp Giáp chi tiết theo thời điểm lập quẻ.</p>
    </header>
    <section className="calc-layout iching-layout">
      <article className="tool-panel calc-form iching-form">
        <div className="iching-method-grid" aria-label="Phương pháp lập quẻ">
          <button className={method==='serial'?'active':''} onClick={() => changeMethod('serial')}><strong>Serial tiền</strong><small>8 chữ số + thời điểm động tâm</small></button>
          <button className={method==='time'?'active':''} onClick={() => changeMethod('time')}><strong>Mai Hoa thời gian</strong><small>Ngày giờ động tâm</small></button>
          <button className={method==='random'?'active':''} onClick={() => changeMethod('random')}><strong>Ngẫu nhiên · Cỏ thi</strong><small>Giả lập 49 stalks</small></button>
          <button className={method==='birth'?'active':''} onClick={() => changeMethod('birth')}><strong>Quẻ số mệnh</strong><small>Ngày tháng năm giờ sinh</small></button>
        </div>

        {method !== 'birth' ? <>
          <label className="iching-question">Việc cần xem<textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder="Nhập đúng câu hỏi đang động tâm..."/></label>
          <label>Người lập quẻ · không bắt buộc<input value={casterName} onChange={event => setCasterName(event.target.value)} placeholder="Tên người hỏi"/></label>
          {method === 'serial' && <label className="serial-field">Serial tiền<input value={serial} onChange={event => setSerial(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="Ví dụ: 20915929"/><small>Nhập đúng 8 chữ số. Có thể dán cả tiền tố chữ; hệ thống chỉ lấy phần số theo đúng thứ tự.</small></label>}
          <div className="datetime-grid"><DateDMYInput label="Ngày lập quẻ / động tâm" value={motionDate} onChange={setMotionDate}/><Time24Input label="Giờ động tâm" value={motionTime} onChange={setMotionTime}/></div>
          <label className="jieqi-toggle"><input type="checkbox" checked={useJieQi} onChange={event => setUseJieQi(event.target.checked)}/><span><strong>Dùng tiết khí để định Nguyệt lệnh</strong><small>{useJieQi ? 'Đang dùng tháng tiết khí cho Nguyệt lệnh và Vượng/Suy.' : 'Đang dùng tháng âm lịch cho Nguyệt lệnh và Vượng/Suy.'}</small></span></label>
          <p className="method-note">Giờ luôn dùng 24h. Tắt “Dùng tiết khí” khi muốn lập Nguyệt lệnh theo tháng âm lịch thay vì ranh giới tiết khí.</p>
        </> : <>
          <label>Họ tên · không bắt buộc<input value={casterName} onChange={event => setCasterName(event.target.value)} placeholder="Tên người xem"/></label>
          <label>Lịch sinh<select value={birthCalendar} onChange={event => { setBirthCalendar(event.target.value as 'solar'|'lunar'); setBirthLeap(false); }}><option value="solar">Dương lịch</option><option value="lunar">Âm lịch</option></select></label>
          <DateDMYInput label={birthCalendar === 'solar' ? 'Ngày sinh dương lịch' : 'Ngày sinh âm lịch'} value={birthDate} onChange={setBirthDate}/>
          {birthCalendar === 'lunar' && <label className="inline-check"><input type="checkbox" checked={birthLeap} onChange={event => setBirthLeap(event.target.checked)}/><span>Tháng nhuận</span></label>}
          <Time24Input label="Giờ sinh" value={birthTime} onChange={setBirthTime}/>
          <label className="jieqi-toggle"><input type="checkbox" checked={useJieQi} onChange={event => setUseJieQi(event.target.checked)}/><span><strong>Dùng tiết khí để định Nguyệt lệnh</strong><small>{useJieQi ? 'Đang dùng tháng tiết khí cho Nguyệt lệnh và Vượng/Suy.' : 'Đang dùng tháng âm lịch cho Nguyệt lệnh và Vượng/Suy.'}</small></span></label>
          <p className="method-note">Công thức lập quẻ số mệnh vẫn dùng ngày/tháng/năm/giờ sinh; lựa chọn tiết khí chỉ đổi Nguyệt lệnh và lớp Lục Hào liên quan.</p>
        </>}

        <button className="primary-action iching-submit" onClick={cast}>LẬP QUẺ</button>
        {error && <div className="error">{error}</div>}
        <p className="source-note">Serial tiền: tách 8 số thành 4–4, cộng từng nhóm chia 8; tổng 8 số chia 6 lấy hào động. Quẻ ngẫu nhiên ghi rõ là mô phỏng Cỏ thi, không giả vờ là nghi thức vật lý.</p>
      </article>

      <article className="result-panel iching-result iching-result-detailed">
        {!result || !meta ? <div className="empty-list">Chọn đúng phương pháp, nhập đủ dữ liệu rồi bấm “LẬP QUẺ”.</div> : <>
          <div className="iching-report-actions"><button className="primary-action" onClick={downloadQuaiImage} disabled={downloading}>{downloading ? 'ĐANG TẠO ẢNH…' : 'TẢI ẢNH QUẺ PNG'}</button><small>Một ảnh duy nhất gồm thông tin lập quẻ, 3 quẻ và toàn bộ bàn Lục Hào.</small></div>
          <div className="iching-export-sheet" ref={exportRef}>
          <div className="iching-sheet-title"><div><span>TRANG DỊCH QUÁI</span><strong>{method === 'birth' ? 'QUẺ SỐ MỆNH' : 'QUẺ HỎI VIỆC'}</strong></div><b>{meta.solarText}</b></div>
          <section className="iching-meta-compact">
            <p><span>Thời gian lập quẻ:</span><b>{meta.solarText}</b><em>({meta.lunarText})</em></p>
            <p><span>Can Chi:</span><b>{meta.canChi}</b></p>
            <p className="meta-inline"><span>Tiết khí:</span><b>{meta.jieQi}</b><span>Nhật thần:</span><b>{meta.daySpirit}</b><span>Nguyệt lệnh:</span><b>{meta.monthCommand}</b><em>{meta.monthMode}</em></p>
            <p><span>Phương pháp lập quẻ:</span><b>{meta.method}</b>{casterName && <><span>Người lập:</span><b>{casterName}</b></>}</p>
            {method !== 'birth' && <p className="meta-question"><span>Việc cần xem:</span><b>{question}</b></p>}
          </section>

          <section className="hex-triptych">
            <div className="hex-card"><div className="hex-result-head"><span>QUẺ CHỦ</span><h2>{result.name}</h2>{hexagramOmens[result.name] && <em className="hex-omen">Triệu: {hexagramOmens[result.name]}</em>}<p>Họ {getHexPalace(result.name).palace}{getHexPalace(result.name).tag ? ' · ' + getHexPalace(result.name).tag : ''}</p></div><HexagramLines lines={result.lines} movingLines={result.movingLines}/><b className="moving-summary">{movingText}</b></div>
            <div className="hex-card"><div className="hex-result-head"><span>QUẺ HỖ</span><h2>{result.mutualName}</h2>{hexagramOmens[result.mutualName] && <em className="hex-omen">Triệu: {hexagramOmens[result.mutualName]}</em>}<p>Họ {getHexPalace(result.mutualName).palace}{getHexPalace(result.mutualName).tag ? ' · ' + getHexPalace(result.mutualName).tag : ''}</p></div><HexagramLines lines={result.mutualLines}/></div>
            <div className="hex-card"><div className="hex-result-head"><span>QUẺ BIẾN</span><h2>{result.changedName}</h2>{hexagramOmens[result.changedName] && <em className="hex-omen">Triệu: {hexagramOmens[result.changedName]}</em>}<p>Họ {getHexPalace(result.changedName).palace}{getHexPalace(result.changedName).tag ? ' · ' + getHexPalace(result.changedName).tag : ''}</p></div><HexagramLines lines={result.changedLines} movingLines={result.movingLines}/></div>
          </section>

          <LiuYaoDetail result={result} meta={meta}/>
          <div className="cast-trace"><strong>Cách lập:</strong> {castNote}</div>
          <div className="iching-sheet-footer"><span>Triệu / tượng bổ trợ: hệ Văn Vương Kim Tiền Khóa, tách khỏi Kinh văn gốc.</span><b>Huyền Học · Kinh Dịch / Lục Hào · {meta.method}</b></div>
          </div>
          <section className="rule-gap-card"><strong>Đã bổ sung xương sống Lục Hào / Nạp Giáp.</strong><p>Hiện đã có Họ quẻ, Thế–Ứng, Nạp Giáp, Lục Thân, Phục Thần, Lục Thú, Tuần Không, Vượng–Tướng–Hưu–Tù–Tử, Quái thân và các dấu Lộc/Mã/Quý/Đào. Các lớp chưa được kiểm chứng đầy đủ theo sách và bộ test sẽ không được tự suy đoán hoặc xuất kết luận.</p></section>
        </>}
      </article>
    </section>
  </main>;
}

type BaziPillar = { title:string; gan:string; zhi:string; label:string; hidden:string[]; hiddenRaw:string[]; naYin:string; tenGodGan:string; tenGodZhi:string[]; growth:string };
type BaziResult = { pillars:BaziPillar[]; dayMaster:string; dayMasterRaw:string; visible:Record<string,number>; hidden:Record<string,number>; total:Record<string,number>; visibleYY:{yin:number;yang:number}; hiddenYY:{yin:number;yang:number}; lunarText:string; monthCommand:string; season:string; voidText:string; interactions:string[] };
const baziGrowthStages=['Trường Sinh','Mộc Dục','Quan Đới','Lâm Quan','Đế Vượng','Suy','Bệnh','Tử','Mộ','Tuyệt','Thai','Dưỡng'];
const baziGrowthStart:Record<string,{zhi:string;forward:boolean}>={甲:{zhi:'亥',forward:true},乙:{zhi:'午',forward:false},丙:{zhi:'寅',forward:true},丁:{zhi:'酉',forward:false},戊:{zhi:'寅',forward:true},己:{zhi:'酉',forward:false},庚:{zhi:'巳',forward:true},辛:{zhi:'子',forward:false},壬:{zhi:'申',forward:true},癸:{zhi:'卯',forward:false}};
const baziSeason:Record<string,string>={寅:'Xuân · Mộc đương lệnh',卯:'Xuân · Mộc đương lệnh',辰:'Cuối Xuân · Thổ chuyển khí',巳:'Hạ · Hỏa đương lệnh',午:'Hạ · Hỏa đương lệnh',未:'Cuối Hạ · Thổ chuyển khí',申:'Thu · Kim đương lệnh',酉:'Thu · Kim đương lệnh',戌:'Cuối Thu · Thổ chuyển khí',亥:'Đông · Thủy đương lệnh',子:'Đông · Thủy đương lệnh',丑:'Cuối Đông · Thổ chuyển khí'};
const baziBranchPairs:{name:string;pairs:string[]}[]=[{name:'Lục hợp',pairs:['子丑','寅亥','卯戌','辰酉','巳申','午未']},{name:'Lục xung',pairs:['子午','丑未','寅申','卯酉','辰戌','巳亥']},{name:'Lục hại',pairs:['子未','丑午','寅巳','卯辰','申亥','酉戌']},{name:'Tương phá',pairs:['子酉','丑辰','寅亥','卯午','巳申','未戌']}];
function baziGrowthStage(dayGan:string,zhi:string){const cfg=baziGrowthStart[dayGan];if(!cfg)return '—';const start=qimenZhi.indexOf(cfg.zhi);const current=qimenZhi.indexOf(zhi);const step=cfg.forward?((current-start+12)%12):((start-current+12)%12);return baziGrowthStages[step];}
function baziInteractions(zhis:string[]){const found:string[]=[];for(const group of baziBranchPairs){for(const pair of group.pairs){const a=pair[0],b=pair[1];if(zhis.includes(a)&&zhis.includes(b))found.push(`${group.name}: ${zhZhiVi[a]||a}–${zhZhiVi[b]||b}`);}}if(zhis.filter(z=>z==='辰').length>=2)found.push('Tự hình: Thìn');if(zhis.filter(z=>z==='午').length>=2)found.push('Tự hình: Ngọ');if(zhis.filter(z=>z==='酉').length>=2)found.push('Tự hình: Dậu');if(zhis.filter(z=>z==='亥').length>=2)found.push('Tự hình: Hợi');return [...new Set(found)];}
type BaziSource = { id:string; viTitle:string; zhTitle:string; author:string; layer:string; use:string; status:string; url?:string };

const baziChinaSources: BaziSource[] = [
  { id:'BAZI-CN-01', viTitle:'Uyên Hải Tử Bình', zhTitle:'《渊海子平》', author:'Cổ điển Tử Bình Trung Quốc', layer:'Tử Bình nền', use:'Nhật chủ · Nguyệt lệnh · Thập thần · cách cục', status:'Đã đăng ký nguồn Trung Quốc', url:'https://www.shidianguji.com/zh/book/NGJ892411999032112149610/chapter/1lqbrsabl0vfe' },
  { id:'BAZI-CN-02', viTitle:'Tam Mệnh Thông Hội', zhTitle:'《三命通会》', author:'Vạn Dân Anh (万民英) · đời Minh', layer:'Tổng hợp Tử Bình', use:'Can Chi · Ngũ hành · tiết khí · đại vận · cách cục · lục thân', status:'Đã có bản Tứ Khố để đối chiếu', url:'https://ctext.org/wiki.pl?if=gb&remap=gb&res=587236' },
  { id:'BAZI-CN-03', viTitle:'Tử Bình Chân Thuyên', zhTitle:'《子平真诠》', author:'Thẩm Hiếu Chiêm (沈孝瞻) · đời Thanh', layer:'Cách cục / dụng thần', use:'Nguyệt lệnh dụng thần · cách cục thành bại · cứu ứng · hành vận', status:'Đã đối chiếu thêm thiên Luận Dụng Thần / Thành Bại Cứu Ứng', url:'https://shuyuan.zhiming.life/read/%E5%AD%90%E5%B9%B3%E7%9C%9F%E8%AF%A0/13' },
  { id:'BAZI-CN-04', viTitle:'Trích Thiên Tủy Xiển Vi', zhTitle:'《滴天髓阐微》', author:'Nhậm Thiết Tiều (任铁樵) chú giải', layer:'Khí thế / vượng suy', use:'Căn khí · suy vượng · trung hòa · nguồn lưu · thông quan · tòng/hóa', status:'Đã có bản chữ Trung Quốc để đối chiếu', url:'https://ctext.org/wiki.pl?chapter=126492&if=gb' },
  { id:'BAZI-CN-05', viTitle:'Cùng Thông Bảo Giám', zhTitle:'《穷通宝鉴》', author:'Dư Xuân Đài (余春台) chỉnh lý từ 《栏江网》', layer:'Điều hậu', use:'Hàn · noãn · táo · thấp theo tháng sinh; giữ riêng lớp điều hậu', status:'Đã bổ sung provenance; văn bản truyền bản còn dị bản nên chưa chạy rule kết luận', url:'https://zh.wikipedia.org/wiki/%E7%A9%B7%E9%80%9A%E5%AF%B6%E9%91%91' },
  { id:'BAZI-CN-06', viTitle:'Thần Phong Thông Khảo', zhTitle:'《神峰通考》', author:'Trương Nam (张楠) · đời Minh', layer:'Thực chiến / bệnh dược', use:'Bệnh–dược · tổ hợp · cách cục · mệnh lệ kiểm chứng', status:'Đã có bản Trung Quốc để đối chiếu', url:'https://ctext.org/wiki.pl?chapter=739505&if=gb&remap=gb' },
  { id:'BAZI-CN-07', viTitle:'Mệnh Lý Ước Ngôn', zhTitle:'《命理约言》', author:'Trần Tố Am (陈素庵)', layer:'Lý luận bổ trợ', use:'Trung hòa · dụng thần · kiểm tra cách luận máy móc', status:'Đang chốt bản gốc Trung Quốc' },
];

function BaziSourceRegistry() {
  return <section className="bazi-source-section">
    <div className="bazi-source-head"><div><span className="feature-eyebrow">NGUỒN BÁT TỰ TRUNG QUỐC</span><h2>Kho nguồn đã Việt hóa</h2></div><b>{baziChinaSources.length} nguồn</b></div>
    <p className="bazi-source-intro">Tên hiển thị được Việt hóa để dễ dùng, nhưng luôn giữ tên Hán văn bên cạnh để truy nguyên. Các trường phái được tách lớp; chưa có rule nào được tự trộn vào Calculation Engine.</p>
    <div className="bazi-source-grid">{baziChinaSources.map(source => <article className="bazi-source-card" key={source.id}>
      <div className="bazi-source-title"><span>{source.id}</span><h3>{source.viTitle}</h3><small>{source.zhTitle}</small></div>
      <p>{source.author}</p><dl><div><dt>Lớp</dt><dd>{source.layer}</dd></div><div><dt>Dùng cho</dt><dd>{source.use}</dd></div><div><dt>Trạng thái</dt><dd>{source.status}</dd></div></dl>
      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Mở nguồn Trung Quốc ↗</a>}
    </article>)}</div>
    <div className="source-policy"><strong>Quy tắc nguồn:</strong> Weibo và bài thảo luận Trung Quốc chỉ dùng để phát hiện trường phái, tranh luận và conflict cần kiểm tra; không tự biến thành rule production. Nguồn gốc sách/scan/chữ cổ được ưu tiên cao hơn.</div>
  </section>;
}

function BaziPage() {
  const [name,setName] = useState(''); const [gender,setGender] = useState<'female'|'male'>('female');
  const [calendar,setCalendar] = useState<'solar'|'lunar'>('solar'); const [isLeapMonth,setIsLeapMonth] = useState(false);
  const [date,setDate] = useState(''); const [time,setTime] = useState(''); const [place,setPlace] = useState('');
  const [sect,setSect] = useState<1|2>(2); const [result,setResult] = useState<BaziResult | null>(null); const [error,setError] = useState('');

  function calculate() {
    try {
      if (!date || !time) throw new Error('Nhập đủ ngày sinh và giờ sinh.');
      const [year,month,day] = date.split('-').map(Number); const [hour,minute] = time.split(':').map(Number);
      const lunar = calendar === 'solar' ? Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar() : Lunar.fromYmdHms(year,isLeapMonth ? -month : month,day,hour,minute,0);
      const eight = lunar.getEightChar(); eight.setSect(sect);
      const gans = [eight.getYearGan(),eight.getMonthGan(),eight.getDayGan(),eight.getTimeGan()];
      const zhis = [eight.getYearZhi(),eight.getMonthZhi(),eight.getDayZhi(),eight.getTimeZhi()];
      const visible = countVisibleElements(gans,zhis); const hidden = countHiddenElements(zhis);
      const titles = ['Năm','Tháng','Ngày','Giờ'];
      const naYin = [eight.getYearNaYin(),eight.getMonthNaYin(),eight.getDayNaYin(),eight.getTimeNaYin()];
      const tenGan = [eight.getYearShiShenGan(),eight.getMonthShiShenGan(),'日主',eight.getTimeShiShenGan()];
      const tenZhi = [eight.getYearShiShenZhi(),eight.getMonthShiShenZhi(),eight.getDayShiShenZhi(),eight.getTimeShiShenZhi()];
      const dayMasterRaw=eight.getDayGan();
      const pillars = titles.map((title,index) => {const hiddenRaw=hiddenGan[zhis[index]]||[];return { title,gan:gans[index],zhi:zhis[index],label:viGanZhi(gans[index]+zhis[index]),hidden:hiddenRaw.map(item => zhGanVi[item] || item),hiddenRaw,naYin:naYin[index],tenGodGan:translateTenGod(tenGan[index]),tenGodZhi:tenZhi[index].map(translateTenGod),growth:baziGrowthStage(dayMasterRaw,zhis[index]) };});
      const monthZhi=eight.getMonthZhi();
      const voidRaw=typeof eight.getDayXunKong==='function'?eight.getDayXunKong():'';
      const voidText=voidRaw?voidRaw.split('').map(item=>zhZhiVi[item]||item).join(' · '):'—';
      setResult({ pillars,dayMaster:zhGanVi[dayMasterRaw] || dayMasterRaw,dayMasterRaw,visible,hidden,total:addElementCounts(visible,hidden),visibleYY:countYinYang(gans,zhis),hiddenYY:countHiddenYinYang(zhis),lunarText:lunar.toString(),monthCommand:zhZhiVi[monthZhi]||monthZhi,season:baziSeason[monthZhi]||'—',voidText,interactions:baziInteractions(zhis) });
      setError('');
    } catch (err) { setResult(null); setError(err instanceof Error ? err.message : 'Không thể lập Bát Tự.'); }
  }

  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">BÁT TỰ · TỨ TRỤ · NGŨ HÀNH</p><h1>Lập Bát Tự</h1><p>Nhật chủ là trung tâm. Tám chữ nổi, tàng can và toàn cục được tách riêng thay vì cộng lẫn ngay từ đầu.</p></header>
    <section className="calc-layout bazi-layout">
      <article className="tool-panel calc-form">
        <label>Tên hồ sơ<input value={name} onChange={event => setName(event.target.value)} placeholder="Không bắt buộc"/></label>
        <label>Giới tính<select value={gender} onChange={event => setGender(event.target.value as 'female'|'male')}><option value="female">Nữ</option><option value="male">Nam</option></select></label>
        <label>Lịch nhập<select value={calendar} onChange={event => { setCalendar(event.target.value as 'solar'|'lunar'); setIsLeapMonth(false); }}><option value="solar">Dương lịch</option><option value="lunar">Âm lịch</option></select></label>
        <DateDMYInput label={calendar === 'solar' ? 'Ngày sinh dương lịch' : 'Ngày sinh âm lịch'} value={date} onChange={setDate}/>
        {calendar === 'lunar' && <label className="inline-check"><input type="checkbox" checked={isLeapMonth} onChange={event => setIsLeapMonth(event.target.checked)}/><span>Tháng nhuận</span></label>}
        <Time24Input label="Giờ sinh" value={time} onChange={setTime}/>
        <label>Nơi sinh<input value={place} onChange={event => setPlace(event.target.value)} placeholder="Tỉnh / thành phố"/></label>
        <label>Quy ước giờ Tý muộn<select value={sect} onChange={event => setSect(Number(event.target.value) as 1|2)}><option value={2}>23h–24h vẫn tính ngày hiện tại</option><option value={1}>23h–24h chuyển sang ngày kế</option></select></label>
        <button className="primary-action" onClick={calculate}>LẬP BÁT TỰ</button>{error && <div className="error">{error}</div>}
        <p className="source-note">Nơi sinh đang được lưu làm đầu vào; hiệu chỉnh chân thái dương/kinh độ chỉ bật khi công thức đã được kiểm chứng đầy đủ.</p>
      </article>
      <article className="result-panel bazi-result">
        {!result ? <div className="empty-list">Chưa lập Bát Tự.</div> : <><div className="bazi-summary bazi-sheet-head"><div><span>{name || 'Hồ sơ Bát Tự'} · {gender === 'female' ? 'Nữ' : 'Nam'}</span><h2>Nhật chủ {result.dayMaster}</h2><p>{result.lunarText}</p></div><dl><div><dt>Nguyệt lệnh</dt><dd>{result.monthCommand}</dd></div><div><dt>Khí mùa</dt><dd>{result.season}</dd></div><div><dt>Tuần không</dt><dd>{result.voidText}</dd></div></dl></div><div className="bazi-chart"><div className="bazi-chart-row bazi-chart-head"><span>Hạng mục</span>{result.pillars.map(p=><b key={p.title}>{p.title}</b>)}</div><div className="bazi-chart-row"><span>Thập thần</span>{result.pillars.map(p=><b key={p.title}>{p.tenGodGan}</b>)}</div><div className="bazi-chart-row bazi-stem-row"><span>Thiên can</span>{result.pillars.map(p=><strong key={p.title}>{zhGanVi[p.gan]||p.gan}<small>{p.gan}</small></strong>)}</div><div className="bazi-chart-row bazi-branch-row"><span>Địa chi</span>{result.pillars.map(p=><strong key={p.title}>{zhZhiVi[p.zhi]||p.zhi}<small>{p.zhi}</small></strong>)}</div><div className="bazi-chart-row bazi-hidden-row"><span>Tàng can</span>{result.pillars.map(p=><div key={p.title}>{p.hidden.map((h,i)=><em key={h+i}>{h}<small>{p.tenGodZhi[i]||'—'}</small></em>)}</div>)}</div><div className="bazi-chart-row"><span>Trường sinh</span>{result.pillars.map(p=><b key={p.title}>{p.growth}</b>)}</div><div className="bazi-chart-row"><span>Nạp âm</span>{result.pillars.map(p=><b key={p.title}>{p.naYin}</b>)}</div></div><section className="bazi-relations"><div className="panel-heading"><div><span className="feature-eyebrow">ĐỊA CHI TƯƠNG TÁC</span><h2>Hợp · Xung · Hại · Phá · Tự hình</h2></div></div>{result.interactions.length?<div className="bazi-relation-tags">{result.interactions.map(item=><span key={item}>{item}</span>)}</div>:<p>Không phát hiện tổ hợp cơ bản trong bốn địa chi theo lớp rule hiện tại.</p>}</section><div className="element-table"><div><b>8 chữ nổi</b>{elementOrder.map(el => <span key={el}>{el} {result.visible[el]}</span>)}<small>Âm {result.visibleYY.yin} · Dương {result.visibleYY.yang}</small></div><div><b>Tàng can</b>{elementOrder.map(el => <span key={el}>{el} {result.hidden[el]}</span>)}<small>Âm {result.hiddenYY.yin} · Dương {result.hiddenYY.yang}</small></div><div><b>Toàn cục</b>{elementOrder.map(el => <span key={el}>{el} {result.total[el]}</span>)}<small>Chỉ thống kê cấu trúc, không lấy số đếm thay cho vượng suy</small></div></div><section className="bazi-analysis-framework"><div><b>01 · Vượng suy</b><span>Nguyệt lệnh → đắc thời → căn khí → sinh trợ → tiết hao → khắc chế.</span></div><div><b>02 · Cách cục</b><span>Lấy Nguyệt lệnh làm trục rồi xét thấu can, thành–bại và cứu ứng.</span></div><div><b>03 · Điều hậu</b><span>Tách riêng hàn · noãn · táo · thấp; không đồng nhất Điều hậu với Dụng thần cách cục.</span></div><div><b>04 · Dụng/Hỷ/Kỵ</b><span>Chỉ mở khi ba lớp trên đã khóa rule và xử lý conflict nguồn.</span></div></section><div className="accuracy-note"><strong>Chưa ép máy phán Cường/Nhược · Dụng/Hỷ/Kỵ.</strong><p>Lá số chỉ xuất những lớp đã có công thức được kiểm chứng. Những phần còn khác biệt giữa các hệ luận được giữ riêng và không tự hợp nhất; thiếu căn cứ thì hệ thống dừng ở dữ liệu cấu trúc thay vì suy đoán.</p></div></>}
      </article>
    </section>

  </main>;
}

type AstroPosition = { key:string; name:string; symbol:string; longitude:number; sign:string; signSymbol:string; degree:number; minute:number };

const zodiacSigns = [
  { name:'Bạch Dương', symbol:'♈' },
  { name:'Kim Ngưu', symbol:'♉' },
  { name:'Song Tử', symbol:'♊' },
  { name:'Cự Giải', symbol:'♋' },
  { name:'Sư Tử', symbol:'♌' },
  { name:'Xử Nữ', symbol:'♍' },
  { name:'Thiên Bình', symbol:'♎' },
  { name:'Bọ Cạp', symbol:'♏' },
  { name:'Nhân Mã', symbol:'♐' },
  { name:'Ma Kết', symbol:'♑' },
  { name:'Bảo Bình', symbol:'♒' },
  { name:'Song Ngư', symbol:'♓' },
];

const astroBodies = [
  { key:'sun', name:'Mặt Trời', symbol:'☉', body:Body.Sun },
  { key:'moon', name:'Mặt Trăng', symbol:'☽', body:Body.Moon },
  { key:'mercury', name:'Sao Thủy', symbol:'☿', body:Body.Mercury },
  { key:'venus', name:'Sao Kim', symbol:'♀', body:Body.Venus },
  { key:'mars', name:'Sao Hỏa', symbol:'♂', body:Body.Mars },
  { key:'jupiter', name:'Sao Mộc', symbol:'♃', body:Body.Jupiter },
  { key:'saturn', name:'Sao Thổ', symbol:'♄', body:Body.Saturn },
  { key:'uranus', name:'Thiên Vương', symbol:'♅', body:Body.Uranus },
  { key:'neptune', name:'Hải Vương', symbol:'♆', body:Body.Neptune },
  { key:'pluto', name:'Diêm Vương', symbol:'♇', body:Body.Pluto },
];

function defaultTimezoneOffset() {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2,'0')}:${String(abs % 60).padStart(2,'0')}`;
}

function currentLocalMoment() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString();
  return { date:local.slice(0,10), time:local.slice(11,16), timezone:defaultTimezoneOffset() };
}

function timezoneMinutes(value:string) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error('Múi giờ phải theo dạng +07:00 hoặc -05:30.');
  const hours = Number(match[2]); const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59) throw new Error('Múi giờ không hợp lệ.');
  const total = hours * 60 + minutes;
  return match[1] === '-' ? -total : total;
}

function astroUtcDate(date:string,time:string,timezone:string) {
  if (!date || !time) throw new Error('Nhập đủ ngày và giờ.');
  const [year,month,day] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  const offset = timezoneMinutes(timezone);
  return new Date(Date.UTC(year,month - 1,day,hour,minute,0) - offset * 60_000);
}

function zodiacPosition(longitude:number) {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const within = normalized - signIndex * 30;
  const degree = Math.floor(within);
  const minute = Math.floor((within - degree) * 60);
  return { sign:zodiacSigns[signIndex].name, signSymbol:zodiacSigns[signIndex].symbol, degree, minute };
}

function calculateAstroPositions(date:string,time:string,timezone:string): AstroPosition[] {
  const utc = astroUtcDate(date,time,timezone);
  return astroBodies.map(item => {
    const ecliptic = Ecliptic(GeoVector(item.body,utc,true));
    const pos = zodiacPosition(ecliptic.elon);
    return { key:item.key,name:item.name,symbol:item.symbol,longitude:ecliptic.elon,...pos };
  });
}

function AstroPositionTable({ positions }:{ positions:AstroPosition[] }) {
  return <div className="astro-position-list">{positions.map(position => <div className="astro-position-row" key={position.key}><span className="astro-glyph">{position.symbol}</span><strong>{position.name}</strong><b>{position.signSymbol} {position.sign}</b><small>{position.degree}° {String(position.minute).padStart(2,'0')}′</small></div>)}</div>;
}

function AstrologyPage() {
  const defaults = useRef(currentLocalMoment()).current;
  const [date,setDate] = useState(defaults.date);
  const [time,setTime] = useState(defaults.time);
  const [timezone,setTimezone] = useState(defaults.timezone);
  const [positions,setPositions] = useState<AstroPosition[] | null>(null);
  const [error,setError] = useState('');

  function calculate() {
    try { setPositions(calculateAstroPositions(date,time,timezone)); setError(''); }
    catch (err) { setPositions(null); setError(err instanceof Error ? err.message : 'Không thể tính chiêm tinh.'); }
  }

  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">CHIÊM TINH PHƯƠNG TÂY · HOÀNG ĐẠO NHIỆT ĐỚI</p><h1>Chiêm tinh</h1><p>Xem vị trí địa tâm của Mặt Trời, Mặt Trăng và các hành tinh tại một thời điểm. Ngày dùng DD/MM/YYYY, giờ dùng 24h.</p></header>
    <section className="calc-layout">
      <article className="tool-panel calc-form">
        <DateDMYInput label="Ngày cần xem" value={date} onChange={setDate}/>
        <Time24Input label="Giờ cần xem" value={time} onChange={setTime}/>
        <label>Múi giờ UTC<input value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="+07:00"/></label>
        <button className="primary-action" onClick={calculate}>TÍNH VỊ TRÍ HÀNH TINH</button>
        {error && <div className="error">{error}</div>}
        <p className="source-note">Tọa độ thiên văn lấy từ Astronomy Engine. Module này chỉ hiển thị vị trí hành tinh; phần luận chiêm tinh sẽ tách thành rule riêng.</p>
      </article>
      <article className="result-panel astro-result">{!positions ? <div className="empty-list">Ngày, giờ và múi giờ đã được điền sẵn theo thiết bị. Bấm “TÍNH VỊ TRÍ HÀNH TINH”.</div> : <><div className="astro-summary"><span>THỜI ĐIỂM</span><h2>{formatDateDMY(date)} · {time}</h2><p>UTC {timezone} · Hoàng đạo nhiệt đới</p></div><AstroPositionTable positions={positions}/></>}</article>
    </section>
  </main>;
}

type SkyLocation = { latitude:number; longitude:number; accuracy?:number };
type SkyBodyPosition = {
  key:string;
  name:string;
  symbol:string;
  azimuth:number;
  altitude:number;
  constellation:string;
  constellationCode:string;
  headingDelta:number;
};

const compassDirections = ['Bắc','Bắc Đông Bắc','Đông Bắc','Đông Đông Bắc','Đông','Đông Đông Nam','Đông Nam','Nam Đông Nam','Nam','Nam Tây Nam','Tây Nam','Tây Tây Nam','Tây','Tây Tây Bắc','Tây Bắc','Bắc Tây Bắc'];

function normalizeDegrees(value:number) {
  return ((value % 360) + 360) % 360;
}

function compassDirection(value:number) {
  return compassDirections[Math.round(normalizeDegrees(value) / 22.5) % 16];
}

function angularDistance(a:number,b:number) {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return Math.min(diff,360 - diff);
}

function calculateSkyBodies(location:SkyLocation,date:Date,heading:number): SkyBodyPosition[] {
  const observer = new Observer(location.latitude,location.longitude,0);
  return astroBodies.map(item => {
    const equDate = Equator(item.body,date,observer,true,true);
    const horizon = Horizon(date,observer,equDate.ra,equDate.dec,'normal');
    const equJ2000 = Equator(item.body,date,observer,false,true);
    const constellation = Constellation(equJ2000.ra,equJ2000.dec);
    return {
      key:item.key,
      name:item.name,
      symbol:item.symbol,
      azimuth:horizon.azimuth,
      altitude:horizon.altitude,
      constellation:constellation.name,
      constellationCode:constellation.symbol,
      headingDelta:angularDistance(horizon.azimuth,heading),    };
  }).sort((a,b) => a.headingDelta - b.headingDelta);
}

function facingConstellation(location:SkyLocation,date:Date,heading:number,altitude:number) {
  const observer = new Observer(location.latitude,location.longitude,0);
  const horizontal = VectorFromHorizon(new Spherical(altitude,normalizeDegrees(heading),1),date,'normal');
  const eqjVector = RotateVector(Rotation_HOR_EQJ(date,observer),horizontal);
  const equatorial = EquatorFromVector(eqjVector);
  return Constellation(equatorial.ra,equatorial.dec);
}

function solarDecan(date:Date) {
  const longitude = normalizeDegrees(Ecliptic(GeoVector(Body.Sun,date,true)).elon);
  const signIndex = Math.floor(longitude / 30);
  const withinSign = longitude - signIndex * 30;
  const decanInSign = Math.floor(withinSign / 10) + 1;
  const globalDecan = Math.floor(longitude / 10) + 1;
  return {
    longitude,
    sign:zodiacSigns[signIndex],
    withinSign,
    decanInSign,
    globalDecan,
  };
}

function SkyCompassPage() {
  const [location,setLocation] = useState<SkyLocation | null>(null);
  const [latInput,setLatInput] = useState('');
  const [lonInput,setLonInput] = useState('');
  const [heading,setHeading] = useState(0);
  const [skyAltitude,setSkyAltitude] = useState(30);
  const [skyTime,setSkyTime] = useState(new Date());
  const [compassEnabled,setCompassEnabled] = useState(false);
  const [status,setStatus] = useState('Chưa lấy vị trí.');
  const [error,setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setSkyTime(new Date()),60_000);
    return () => window.clearInterval(timer);
  },[]);

  useEffect(() => {
    if (!compassEnabled) return;
    const handler = (rawEvent:Event) => {
      const event = rawEvent as DeviceOrientationEvent & { webkitCompassHeading?:number };
      const iosHeading = event.webkitCompassHeading;
      const alphaHeading = event.alpha == null ? null : normalizeDegrees(360 - event.alpha);
      const next = typeof iosHeading === 'number' ? iosHeading : alphaHeading;
      if (next != null && Number.isFinite(next)) setHeading(Math.round(normalizeDegrees(next) * 10) / 10);
    };
    window.addEventListener('deviceorientationabsolute',handler,true);
    window.addEventListener('deviceorientation',handler,true);
    return () => {
      window.removeEventListener('deviceorientationabsolute',handler,true);
      window.removeEventListener('deviceorientation',handler,true);
    };
  },[compassEnabled]);

  function useManualLocation() {
    const latitude = Number(latInput);
    const longitude = Number(lonInput);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Tọa độ không hợp lệ. Vĩ độ -90…90, kinh độ -180…180.');
      return;
    }
    setLocation({latitude,longitude});
    setSkyTime(new Date());
    setStatus('Đang dùng tọa độ đã nhập.');
    setError('');
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setError('Trình duyệt này không hỗ trợ GPS. Bạn vẫn có thể nhập tọa độ thủ công.');
      return;
    }
    setStatus('Đang xin quyền vị trí…');
    navigator.geolocation.getCurrentPosition(position => {
      const next = {
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy:position.coords.accuracy,
      };
      setLocation(next);
      setLatInput(next.latitude.toFixed(6));
      setLonInput(next.longitude.toFixed(6));
      setSkyTime(new Date());
      setStatus('Đã lấy vị trí từ thiết bị.');
      setError('');
    },() => {
      setStatus('Không lấy được GPS.');
      setError('Quyền vị trí bị từ chối hoặc GPS không khả dụng. Có thể nhập tọa độ thủ công.');
    },{enableHighAccuracy:true,timeout:12_000,maximumAge:60_000});
  }

  async function enableCompass() {
    try {
      const OrientationCtor = DeviceOrientationEvent as unknown as { requestPermission?:() => Promise<'granted'|'denied'> };
      if (typeof OrientationCtor.requestPermission === 'function') {
        const permission = await OrientationCtor.requestPermission();
        if (permission !== 'granted') {
          setError('Thiết bị chưa cấp quyền la bàn. Bạn vẫn có thể chỉnh hướng thủ công.');
          return;
        }
      }
      setCompassEnabled(true);
      setError('');
    } catch {
      setError('Không bật được cảm biến hướng. Bạn vẫn có thể chỉnh hướng thủ công.');
    }
  }

  let bodies:SkyBodyPosition[] = [];
  let frontConstellation:{name:string;symbol:string} | null = null;
  let decan:ReturnType<typeof solarDecan> | null = null;
  if (location) {
    try {
      bodies = calculateSkyBodies(location,skyTime,heading);
      const front = facingConstellation(location,skyTime,heading,skyAltitude);
      frontConstellation = {name:front.name,symbol:front.symbol};
      decan = solarDecan(skyTime);
    } catch {
      bodies = [];
    }
  }
  const inFront = bodies.filter(item => item.headingDelta <= 30);
  const shownBodies = (inFront.length ? inFront : bodies.slice(0,4)).slice(0,6);

  return <main className="workspace module-page sky-page">
    <header className="module-header">
      <p className="eyebrow">THIÊN TƯỢNG · GPS · TINH BÀN</p>
      <h1>Huyền Thiên Tinh Bàn</h1>
      <p>Không cần chĩa điện thoại lên trời. App lấy vị trí, thời gian và hướng bạn đang quay mặt để tính vùng trời phía trước.</p>
    </header>

    <section className="sky-layout">
      <article className="tool-panel sky-controls">
        <div className="sky-control-head"><span>01</span><div><strong>Vị trí quan sát</strong><small>GPS chỉ được yêu cầu khi bạn bấm nút.</small></div></div>
        <button className="primary-action" onClick={requestLocation}>LẤY VỊ TRÍ GPS</button>
        <div className="sky-coordinate-grid">
          <label>Vĩ độ<input inputMode="decimal" value={latInput} onChange={event => setLatInput(event.target.value)} placeholder="Ví dụ 21.0285"/></label>
          <label>Kinh độ<input inputMode="decimal" value={lonInput} onChange={event => setLonInput(event.target.value)} placeholder="Ví dụ 105.8542"/></label>
        </div>
        <button className="secondary-action" onClick={useManualLocation}>DÙNG TỌA ĐỘ NÀY</button>
        <p className="sky-status">{status}{location?.accuracy ? ` · sai số GPS khoảng ${Math.round(location.accuracy)} m` : ''}</p>

        <div className="sky-control-head"><span>02</span><div><strong>Hướng đang quay mặt</strong><small>Dùng cảm biến la bàn hoặc chỉnh thủ công.</small></div></div>
        <button className="secondary-action" onClick={enableCompass}>{compassEnabled ? 'LA BÀN ĐANG BẬT' : 'BẬT LA BÀN THIẾT BỊ'}</button>
        <label>Góc phương vị · 0° Bắc, 90° Đông<input type="number" min="0" max="359.9" step="0.1" value={heading} onChange={event => setHeading(normalizeDegrees(Number(event.target.value) || 0))}/></label>
        <label className="sky-range">Độ cao vùng trời tham chiếu · {skyAltitude}°<input type="range" min="0" max="80" value={skyAltitude} onChange={event => setSkyAltitude(Number(event.target.value))}/></label>
        {error && <div className="error">{error}</div>}
      </article>

      <article className="result-panel sky-result">
        {!location ? <div className="empty-list">Bấm “LẤY VỊ TRÍ GPS” hoặc nhập tọa độ để mở la bàn thiên tượng.</div> : <>
          <div className="sky-hero">
            <div className="sky-compass" aria-label="La bàn hướng nhìn">
              <span className="sky-north">B</span><span className="sky-east">Đ</span><span className="sky-south">N</span><span className="sky-west">T</span>
              <div className="sky-needle" style={{transform:`translate(-50%,-100%) rotate(${heading}deg)`}}><i/></div>
              <div className="sky-compass-center"><strong>{Math.round(heading)}°</strong><small>{compassDirection(heading)}</small></div>
            </div>
            <div className="sky-facing">
              <span>VÙNG TRỜI PHÍA TRƯỚC</span>
              <h2>{frontConstellation ? `${frontConstellation.name} · ${frontConstellation.symbol}` : 'Đang tính…'}</h2>
              <p>Phương vị {heading.toFixed(1)}° · độ cao tham chiếu {skyAltitude}°</p>
              <small>{skyTime.toLocaleString('vi-VN',{hour12:false})}</small>
            </div>
          </div>

          <section className="sky-body-section">
            <div className="panel-heading"><div><span className="feature-eyebrow">THIÊN THỂ THEO HƯỚNG NHÌN</span><h2>{inFront.length ? 'Trong dải ±30° phía trước' : 'Các thiên thể gần hướng nhìn nhất'}</h2></div><b>{compassDirection(heading)}</b></div>
            <div className="sky-body-grid">{shownBodies.map(item => <article className={item.altitude >= 0 ? 'sky-body-card visible' : 'sky-body-card'} key={item.key}>
              <span className="sky-body-symbol">{item.symbol}</span>
              <div><strong>{item.name}</strong><small>{item.constellation} · {item.constellationCode}</small></div>
              <dl><div><dt>Phương vị</dt><dd>{item.azimuth.toFixed(1)}° · {compassDirection(item.azimuth)}</dd></div><div><dt>Độ cao</dt><dd>{item.altitude.toFixed(1)}°</dd></div><div><dt>Lệch hướng</dt><dd>{item.headingDelta.toFixed(1)}°</dd></div></dl>
              <em>{item.altitude >= 0 ? 'Trên đường chân trời' : 'Dưới đường chân trời'}</em>
            </article>)}</div>
          </section>

          {decan && <section className="egypt-decan-card">
            <div><span>AI CẬP · LỚP DECAN HOÀNG ĐẠO HẬU KỲ</span><h2>Decan {decan.decanInSign} của {decan.sign.name}</h2><p>{decan.sign.symbol} {Math.floor(decan.withinSign)}° · Decan toàn vòng số {decan.globalDecan}/36</p></div>
            <div className="decan-meter"><i style={{width:`${((decan.withinSign % 10) / 10) * 100}%`}}/></div>
            <small>Đây là lớp 36 phần × 10° của hoàng đạo dùng trong truyền thống Ai Cập–Hy Lạp hậu kỳ. Decan cổ Ai Cập ban đầu là các nhóm sao dùng đo giờ ban đêm, nên app tách hai khái niệm thay vì gán cưỡng ép một chòm sao hiện đại vào một decan cổ.</small>
          </section>}

          <div className="sky-data-ready"><strong>Dữ liệu đã sẵn sàng cho “Bản tin hôm nay”.</strong><span>Vị trí · thời gian · hướng nhìn · chòm sao phía trước · thiên thể gần hướng · decan hoàng đạo.</span></div>
        </>}
      </article>
    </section>
  </main>;
}

function NatalWheel({ positions }:{ positions:AstroPosition[] }) {
  const center = 200; const radius = 164; const planetRadius = 132;
  return <svg className="natal-wheel" viewBox="0 0 400 400" role="img" aria-label="Bản đồ sao vòng hoàng đạo">
    <circle cx={center} cy={center} r={radius} className="wheel-ring"/>
    <circle cx={center} cy={center} r={110} className="wheel-inner"/>
    {zodiacSigns.map((sign,index) => {
      const angle = index * 30 - 90;
      const rad = angle * Math.PI / 180;
      const x1 = center + Math.cos(rad) * 110; const y1 = center + Math.sin(rad) * 110;
      const x2 = center + Math.cos(rad) * radius; const y2 = center + Math.sin(rad) * radius;
      const labelAngle = (index * 30 + 15 - 90) * Math.PI / 180;
      const tx = center + Math.cos(labelAngle) * 149; const ty = center + Math.sin(labelAngle) * 149;
      return <g key={sign.name}><line x1={x1} y1={y1} x2={x2} y2={y2} className="wheel-spoke"/><text x={tx} y={ty} className="wheel-zodiac">{sign.symbol}</text></g>;
    })}
    {positions.map((position,index) => {
      const angle = (position.longitude - 90) * Math.PI / 180;
      const lane = planetRadius - (index % 3) * 12;
      const x = center + Math.cos(angle) * lane; const y = center + Math.sin(angle) * lane;
      return <g key={position.key}><circle cx={x} cy={y} r={11} className="wheel-planet-dot"/><text x={x} y={y + 4} className="wheel-planet">{position.symbol}</text></g>;
    })}
    <text x="200" y="194" className="wheel-center-title">BẢN ĐỒ SAO</text>
    <text x="200" y="211" className="wheel-center-note">vòng hoàng đạo</text>
  </svg>;
}

function NatalChartPage() {
  const [name,setName] = useState('');
  const [date,setDate] = useState('');
  const [time,setTime] = useState('');
  const [place,setPlace] = useState('');
  const [timezone,setTimezone] = useState(defaultTimezoneOffset());
  const [positions,setPositions] = useState<AstroPosition[] | null>(null);
  const [error,setError] = useState('');

  function calculate() {
    try { setPositions(calculateAstroPositions(date,time,timezone)); setError(''); }
    catch (err) { setPositions(null); setError(err instanceof Error ? err.message : 'Không thể dựng bản đồ sao.'); }
  }

  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">NATAL CHART · BẢN ĐỒ SAO CÁ NHÂN</p><h1>Bản đồ sao</h1><p>Dựng vòng hoàng đạo từ ngày, giờ sinh và múi giờ. Hệ nhà và Cung Mọc chưa được tự đoán khi chưa có tọa độ sinh và quy ước hệ nhà.</p></header>
    <section className="calc-layout natal-layout">
      <article className="tool-panel calc-form">
        <label>Họ tên<input value={name} onChange={event => setName(event.target.value)} placeholder="Không bắt buộc"/></label>
        <DateDMYInput label="Ngày sinh" value={date} onChange={setDate}/>
        <Time24Input label="Giờ sinh" value={time} onChange={setTime}/>
        <label>Múi giờ nơi sinh<input value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="+07:00"/></label>
        <label>Nơi sinh<input value={place} onChange={event => setPlace(event.target.value)} placeholder="Tỉnh / thành phố / quốc gia"/></label>
        <button className="primary-action" onClick={calculate}>DỰNG BẢN ĐỒ SAO</button>
        {error && <div className="error">{error}</div>}
        <div className="accuracy-note"><strong>Không tự bịa Cung Mọc / 12 nhà.</strong><p>Vòng hiện tại là vị trí hành tinh trên hoàng đạo nhiệt đới. Muốn tính ASC/MC và nhà phải bổ sung tọa độ địa lý và khóa hệ nhà như Placidus, Whole Sign hoặc Equal House.</p></div>
      </article>
      <article className="result-panel natal-result">{!positions ? <div className="empty-list">Nhập ngày sinh, giờ sinh và múi giờ để dựng bản đồ sao.</div> : <><div className="astro-summary"><span>{name || 'HỒ SƠ BẢN ĐỒ SAO'}</span><h2>{formatDateDMY(date)} · {time}</h2><p>{place || 'Chưa ghi nơi sinh'} · UTC {timezone}</p></div><div className="natal-chart-grid"><NatalWheel positions={positions}/><AstroPositionTable positions={positions}/></div></>}</article>
    </section>
  </main>;
}

const numerologyLetterValues: Record<string,number> = Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((char,index) => [char,index % 9 + 1]));

function cleanNumerologyName(value:string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Đ/g,'D').replace(/đ/g,'d').toUpperCase().replace(/[^A-Z]/g,'');
}

function reduceNumerology(value:number) {
  let current = Math.abs(Math.trunc(value));
  while (current > 9 && ![11,22,33].includes(current)) current = String(current).split('').reduce((sum,digit) => sum + Number(digit),0);
  return current;
}

function nameNumber(name:string,mode:'all'|'vowels'|'consonants') {
  const clean = cleanNumerologyName(name);
  const vowels = new Set(['A','E','I','O','U']);
  const selected = clean.split('').filter(char => mode === 'all' || (mode === 'vowels' ? vowels.has(char) : !vowels.has(char)));
  return reduceNumerology(selected.reduce((sum,char) => sum + (numerologyLetterValues[char] || 0),0));
}

function NumerologyPage() {
  const [name,setName] = useState('');
  const [date,setDate] = useState('');
  const [result,setResult] = useState<null | { life:number; birthday:number; attitude:number; expression:number; soul:number; personality:number }>(null);
  const [error,setError] = useState('');

  function calculate() {
    try {
      if (!name.trim() || !date) throw new Error('Nhập đủ họ tên và ngày sinh.');
      const [year,month,day] = date.split('-').map(Number);
      const life = reduceNumerology(String(year).split('').reduce((s,d)=>s+Number(d),0) + String(month).split('').reduce((s,d)=>s+Number(d),0) + String(day).split('').reduce((s,d)=>s+Number(d),0));
      setResult({ life,birthday:reduceNumerology(day),attitude:reduceNumerology(day + month),expression:nameNumber(name,'all'),soul:nameNumber(name,'vowels'),personality:nameNumber(name,'consonants') });
      setError('');
    } catch (err) { setResult(null); setError(err instanceof Error ? err.message : 'Không thể tính thần số học.'); }
  }

  const labels = result ? [
    ['Đường đời',result.life,'Tổng năng lượng ngày sinh'],
    ['Ngày sinh',result.birthday,'Năng lượng riêng của ngày sinh'],
    ['Thái độ',result.attitude,'Ngày + tháng sinh'],
    ['Sứ mệnh / Biểu đạt',result.expression,'Toàn bộ chữ cái trong họ tên'],
    ['Linh hồn',result.soul,'Nguyên âm A E I O U'],
    ['Nhân cách',result.personality,'Phụ âm trong họ tên'],
  ] as const : [];

  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">THẦN SỐ HỌC · HỆ PYTHAGORAS</p><h1>Thần số học</h1><p>Tính các chỉ số cơ bản từ họ tên và ngày sinh. Hệ thống giữ các số chủ 11, 22 và 33.</p></header>
    <section className="calc-layout numerology-layout">
      <article className="tool-panel calc-form">
        <label>Họ tên đầy đủ<input value={name} onChange={event => setName(event.target.value)} placeholder="Nhập đúng họ tên cần tính"/></label>
        <DateDMYInput label="Ngày sinh" value={date} onChange={setDate}/>
        <button className="primary-action" onClick={calculate}>TÍNH THẦN SỐ HỌC</button>
        {error && <div className="error">{error}</div>}
        <p className="source-note">Quy ước hiện tại: Pythagoras A=1… I=9 rồi lặp lại; giữ 11/22/33. Chữ Việt được bỏ dấu trước khi quy đổi; Y mặc định tính là phụ âm.</p>
      </article>
      <article className="result-panel numerology-result">{!result ? <div className="empty-list">Nhập họ tên và ngày sinh để tính.</div> : <><div className="astro-summary"><span>HỆ PYTHAGORAS</span><h2>{name}</h2><p>{formatDateDMY(date)}</p></div><div className="numerology-grid">{labels.map(([label,value,note]) => <div className="number-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div></>}</article>
    </section>
  </main>;
}

type QimenSource = { id:string; viTitle:string; zhTitle:string; layer:string; use:string; status:string; url:string };

const qimenSources: QimenSource[] = [
  { id:'QMDJ-CN-01', viTitle:'Độn Giáp Diễn Nghĩa', zhTitle:'《遁甲演义》', layer:'Tứ Khố / lý pháp nền', use:'Âm Dương Độn · 24 tiết khí · Tam nguyên · Cửu cung · Tam kỳ Lục nghi · Trực Phù/Trực Sử', status:'Đã đối chiếu bản Tứ Khố', url:'https://zh.wikisource.org/zh-hans/%E9%81%81%E7%94%B2%E6%BC%94%E7%BE%A9_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)' },
  { id:'QMDJ-CN-02', viTitle:'Ngự Định Kỳ Môn Độn Giáp Bảo Giám', zhTitle:'《御定奇门遁甲宝鉴》', layer:'Ngự định / chú giải', use:'Lục nghi · Tam kỳ · Trực Phù · Trực Sử · cách cục và điều kiện sử dụng', status:'Đã có bản chữ đối chiếu', url:'https://ctext.org/wiki.pl?chapter=250961&if=gb' },
  { id:'QMDJ-CN-03', viTitle:'Kỳ Môn Độn Giáp Thống Tông', zhTitle:'《奇门遁甲统宗》', layer:'Thống hệ / bàn cục', use:'18 cục · Cửu tinh · Bát môn · quy tắc định cục và dụng môn', status:'Có scan Thư viện Quốc gia Trung Quốc', url:'https://commons.wikimedia.org/wiki/File:NLC416-12jh003951-48665_%E5%A5%87%E9%96%80%E9%81%81%E7%94%B2%E7%B5%B1%E5%AE%97.pdf' },
  { id:'QMDJ-CN-04', viTitle:'Yên Ba Điếu Tẩu Ca', zhTitle:'《烟波钓叟歌》', layer:'Khẩu quyết cổ', use:'Âm Dương thuận nghịch · Tam kỳ Lục nghi · cát môn · Phục/Phản ngâm · Ngũ bất ngộ thời', status:'Đã đối chiếu văn bản Trung Quốc', url:'https://zh.wikisource.org/zh-hans/%E7%85%99%E6%B3%A2%E9%87%A3%E5%8F%9F%E6%AD%8C' },
  { id:'QMDJ-CN-05', viTitle:'Kỳ Môn Độn Giáp Bí Kíp Đại Toàn', zhTitle:'《奇门遁甲秘笈大全》', layer:'Tổng tập', use:'Bảng 24 tiết khí × Thượng/Trung/Hạ nguyên → 18 cục', status:'Đã đối chiếu chương Âm/Dương Độn Cửu Cục', url:'https://ctext.org/wiki.pl?chapter=91342&if=gb&remap=gb' },
];

const qimenTermTable: Record<string,{ dun:'Dương'|'Âm'; ju:[number,number,number] }> = {
  '冬至':{dun:'Dương',ju:[1,7,4]}, '小寒':{dun:'Dương',ju:[2,8,5]}, '大寒':{dun:'Dương',ju:[3,9,6]},
  '立春':{dun:'Dương',ju:[8,5,2]}, '雨水':{dun:'Dương',ju:[9,6,3]}, '惊蛰':{dun:'Dương',ju:[1,7,4]},
  '春分':{dun:'Dương',ju:[3,9,6]}, '清明':{dun:'Dương',ju:[4,1,7]}, '谷雨':{dun:'Dương',ju:[5,2,8]},
  '立夏':{dun:'Dương',ju:[4,1,7]}, '小满':{dun:'Dương',ju:[5,2,8]}, '芒种':{dun:'Dương',ju:[6,3,9]},
  '夏至':{dun:'Âm',ju:[9,3,6]}, '小暑':{dun:'Âm',ju:[8,2,5]}, '大暑':{dun:'Âm',ju:[7,1,4]},
  '立秋':{dun:'Âm',ju:[2,5,8]}, '处暑':{dun:'Âm',ju:[1,4,7]}, '白露':{dun:'Âm',ju:[9,3,6]},
  '秋分':{dun:'Âm',ju:[7,1,4]}, '寒露':{dun:'Âm',ju:[6,9,3]}, '霜降':{dun:'Âm',ju:[5,8,2]},
  '立冬':{dun:'Âm',ju:[6,9,3]}, '小雪':{dun:'Âm',ju:[5,8,2]}, '大雪':{dun:'Âm',ju:[4,7,1]},
};

const qimenPalaces: Record<number,{ name:string; direction:string; star:string; door:string }> = {
  1:{name:'Khảm',direction:'Bắc',star:'Thiên Bồng',door:'Hưu Môn'},
  2:{name:'Khôn',direction:'Tây Nam',star:'Thiên Nhuế',door:'Tử Môn'},
  3:{name:'Chấn',direction:'Đông',star:'Thiên Xung',door:'Thương Môn'},
  4:{name:'Tốn',direction:'Đông Nam',star:'Thiên Phụ',door:'Đỗ Môn'},
  5:{name:'Trung',direction:'Trung cung',star:'Thiên Cầm',door:'—'},
  6:{name:'Càn',direction:'Tây Bắc',star:'Thiên Tâm',door:'Khai Môn'},
  7:{name:'Đoài',direction:'Tây',star:'Thiên Trụ',door:'Kinh Môn'},
  8:{name:'Cấn',direction:'Đông Bắc',star:'Thiên Nhậm',door:'Sinh Môn'},
  9:{name:'Ly',direction:'Nam',star:'Thiên Anh',door:'Cảnh Môn'},
};

const qimenEarthSequence = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
const qimenGan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const qimenZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const qimenYuanNames = ['Thượng nguyên','Trung nguyên','Hạ nguyên'];
const qimenXunHidden = ['戊','己','庚','辛','壬','癸'];
const qimenXunNames = ['Giáp Tý','Giáp Tuất','Giáp Thân','Giáp Ngọ','Giáp Thìn','Giáp Dần'];
const qimenGoodDoors = new Set(['Khai Môn','Hưu Môn','Sinh Môn']);
const qimenThreeWonders = new Set(['乙','丙','丁']);
const qimenFiveNotMeet: Record<string,string> = {
  '甲':'庚午','乙':'辛巳','丙':'壬辰','丁':'癸卯','戊':'甲寅','己':'乙丑','庚':'丙子','辛':'丁酉','壬':'戊申','癸':'己未',
};

function normalizeQimenTerm(value:string) {
  return ({'驚蟄':'惊蛰','穀雨':'谷雨','小滿':'小满','芒種':'芒种','處暑':'处暑'} as Record<string,string>)[value] || value;
}

function qimenSexagenaryIndex(gan:string,zhi:string) {
  for (let index = 0; index < 60; index += 1) {
    if (qimenGan[index % 10] === gan && qimenZhi[index % 12] === zhi) return index;
  }
  return -1;
}

function qimenEarthPlate(dun:'Dương'|'Âm',ju:number) {
  const plate:Record<number,string> = {};
  qimenEarthSequence.forEach((stem,index) => {
    const offset = dun === 'Dương' ? index : -index;
    const palace = ((ju - 1 + offset) % 9 + 9) % 9 + 1;
    plate[palace] = stem;
  });
  return plate;
}

function calculateQimen(date:string,time:string) {
  if (!date || !time) throw new Error('Nhập đủ ngày và giờ để lập Kỳ Môn.');
  const [year,month,day] = date.split('-').map(Number);
  const [hour,minute] = time.split(':').map(Number);
  const lunar = Solar.fromYmdHms(year,month,day,hour,minute,0).getLunar();
  const eight = lunar.getEightChar();
  const jieQiRaw = normalizeQimenTerm(lunar.getPrevJieQi(false)?.getName?.() || lunar.getJieQi?.() || '');
  const termRule = qimenTermTable[jieQiRaw];
  if (!termRule) throw new Error('Chưa xác định được tiết khí để định cục Kỳ Môn.');

  const dayIndex = qimenSexagenaryIndex(eight.getDayGan(),eight.getDayZhi());
  const yuanIndex = dayIndex >= 0 ? Math.floor(dayIndex / 5) % 3 : 0;
  const ju = termRule.ju[yuanIndex];
  const earth = qimenEarthPlate(termRule.dun,ju);

  const hourIndex = qimenSexagenaryIndex(eight.getTimeGan(),eight.getTimeZhi());
  const xunIndex = hourIndex >= 0 ? Math.floor(hourIndex / 10) : 0;
  const hiddenStem = qimenXunHidden[xunIndex];
  const valuePalace = Number(Object.keys(earth).find(key => earth[Number(key)] === hiddenStem) || 5);
  const valueStar = qimenPalaces[valuePalace].star;
  const valueDoor = qimenPalaces[valuePalace].door;
  const dayGan = eight.getDayGan();
  const timeGanZhi = `${eight.getTimeGan()}${eight.getTimeZhi()}`;
  const fiveNotEncountering = qimenFiveNotMeet[dayGan] === timeGanZhi;

  return {
    lunar,
    eight,
    jieQiRaw,
    jieQiVi:jieQiVi[jieQiRaw] || jieQiRaw,
    dun:termRule.dun,
    yuanIndex,
    yuan:qimenYuanNames[yuanIndex],
    ju,
    earth,
    xun:qimenXunNames[xunIndex],
    hiddenStem,
    valuePalace,
    valueStar,
    valueDoor,
    fiveNotEncountering,
    dayGan,
    timeGanZhi,
  };
}

function QimenSourceRegistry() {
  return <section className="bazi-source-section qimen-source-section">
    <div className="bazi-source-head"><div><span className="feature-eyebrow">NGUỒN KỲ MÔN TRUNG QUỐC</span><h2>Rulebook Kỳ Môn Độn Giáp</h2></div><b>{qimenSources.length} nguồn</b></div>
    <p className="bazi-source-intro">Tên sách và rule đã Việt hóa để dùng trong app, nhưng giữ Hán văn và đường dẫn gốc để truy nguyên. Chỉ phần đã đối chiếu mới được chạy trong Calculation Engine.</p>
    <div className="bazi-source-grid">{qimenSources.map(source => <article className="bazi-source-card" key={source.id}>
      <div className="bazi-source-title"><span>{source.id}</span><h3>{source.viTitle}</h3><small>{source.zhTitle}</small></div>
      <dl><div><dt>Lớp</dt><dd>{source.layer}</dd></div><div><dt>Dùng cho</dt><dd>{source.use}</dd></div><div><dt>Trạng thái</dt><dd>{source.status}</dd></div></dl>
      <a href={source.url} target="_blank" rel="noreferrer">Mở nguồn Trung Quốc ↗</a>
    </article>)}</div>
    <div className="source-policy"><strong>Rule đang chạy:</strong> QMDJ-CN-CORE-001 → 007: Âm/Dương Độn, Tam nguyên, 18 cục, địa bàn Tam kỳ Lục nghi, bản vị Cửu tinh/Bát môn, Tuần thủ → Trực Phù/Trực Sử, Ngũ bất ngộ thời. Thiên bàn/Nhân bàn/Thần bàn xoay động chưa được giả lập khi chưa khóa tiếp công thức.</div>
  </section>;
}

function QimenPage() {
  const defaults = useRef(currentLocalMoment()).current;
  const [date,setDate] = useState(defaults.date);
  const [time,setTime] = useState(defaults.time);
  const [result,setResult] = useState<ReturnType<typeof calculateQimen> | null>(null);
  const [error,setError] = useState('');

  function calculate() {
    try {
      setResult(calculateQimen(date,time));
      setError('');
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Không thể lập Kỳ Môn.');
    }
  }

  const palaceOrder = [4,9,2,3,5,7,8,1,6];

  return <main className="workspace module-page qimen-page">
    <header className="module-header"><p className="eyebrow">KỲ MÔN ĐỘN GIÁP</p><h1>Kỳ Môn Độn Giáp</h1><p>Thời gia Kỳ Môn · lập cục bằng tiết khí và Tam nguyên. Calculation Engine chỉ chạy công thức đã kiểm chứng; không dùng AI để tự đoán công thức.</p></header>
    <section className="calc-layout qimen-layout">
      <article className="tool-panel calc-form">
        <DateDMYInput label="Ngày lập cục" value={date} onChange={setDate}/>
        <Time24Input label="Giờ lập cục" value={time} onChange={setTime}/>
        <button className="primary-action" onClick={calculate}>LẬP KỲ MÔN</button>
        {error && <div className="error">{error}</div>}
        <div className="accuracy-note"><strong>Quy ước hiện tại</strong><p>Dùng Thời gia Kỳ Môn theo 24 tiết khí: Đông chí → trước Hạ chí là Dương Độn; Hạ chí → trước Đông chí là Âm Độn. Tam nguyên chia theo từng nhóm 5 ngày trong vòng 60 Giáp Tý.</p></div>
        <div className="qimen-rule-list">
          <div><b>QMDJ-CN-CORE-001</b><span>24 tiết khí → Âm/Dương Độn</span></div>
          <div><b>QMDJ-CN-CORE-002</b><span>5 ngày → Thượng/Trung/Hạ nguyên</span></div>
          <div><b>QMDJ-CN-CORE-003</b><span>Tiết khí × Tam nguyên → 18 cục</span></div>
          <div><b>QMDJ-CN-CORE-004</b><span>Địa bàn Tam kỳ Lục nghi</span></div>
          <div><b>QMDJ-CN-CORE-005</b><span>Cửu tinh / Bát môn bản vị</span></div>
          <div><b>QMDJ-CN-CORE-006</b><span>Tuần thủ → Trực Phù / Trực Sử</span></div>
          <div><b>QMDJ-CN-CORE-007</b><span>Ngũ bất ngộ thời</span></div>
        </div>
      </article>

      <article className="result-panel qimen-result">{!result ? <div className="empty-list">Ngày và giờ đã điền theo thiết bị. Bấm “LẬP KỲ MÔN”.</div> : <>
        <div className="qimen-summary">
          <div><span>TIẾT KHÍ</span><strong>{result.jieQiVi}</strong><small>{result.jieQiRaw}</small></div>
          <div><span>ĐỘN</span><strong>{result.dun} Độn</strong><small>{result.dun === 'Dương' ? 'Lục nghi thuận bố' : 'Lục nghi nghịch bố'}</small></div>
          <div><span>TAM NGUYÊN</span><strong>{result.yuan}</strong><small>{viGanZhi(result.eight.getDay())}</small></div>
          <div><span>CỤC</span><strong>{result.dun} {result.ju} cục</strong><small>18 cục cổ điển</small></div>
        </div>

        <div className="qimen-value-strip">
          <div><span>Tuần thủ</span><b>{result.xun} ẩn {zhGanVi[result.hiddenStem] || result.hiddenStem}</b></div>
          <div><span>Trực Phù</span><b>{result.valueStar}</b></div>
          <div><span>Trực Sử</span><b>{result.valueDoor === '—' ? 'Trung cung · vô môn' : result.valueDoor}</b></div>
          <div className={result.fiveNotEncountering ? 'warning' : 'ok'}><span>Ngũ bất ngộ thời</span><b>{result.fiveNotEncountering ? 'CÓ · cần cảnh báo' : 'Không phạm'}</b></div>
        </div>

        <section className="qimen-board" aria-label="Địa bàn Kỳ Môn">{palaceOrder.map(palace => {
          const base = qimenPalaces[palace];
          const earthStem = result.earth[palace];
          const isValue = palace === result.valuePalace;
          return <article className={isValue ? 'qimen-palace value' : 'qimen-palace'} key={palace}>
            <div className="qimen-palace-head"><span>{base.name} {palace}</span><small>{base.direction}</small></div>
            <strong className={qimenThreeWonders.has(earthStem) ? 'wonder' : ''}>{zhGanVi[earthStem] || earthStem}</strong>
            <p>{base.star}</p>
            <em className={qimenGoodDoors.has(base.door) ? 'good-door' : ''}>{base.door}</em>
            {isValue && <b className="value-mark">Tuần thủ</b>}
          </article>;
        })}</section>

        <div className="qimen-legend"><span><i className="wonder-dot"/> Tam kỳ: Ất · Bính · Đinh</span><span><i className="door-dot"/> Tam cát môn bản vị: Khai · Hưu · Sinh</span><small>Đây là địa bàn + bản vị. Không coi vị trí cửa/sao bản vị là vị trí Thiên/Nhân bàn hiện thời.</small></div>
      </>}</article>
    </section>

  </main>;
}

type AppSection = 'dashboard' | 'totalfortune' | 'vantam' | 'tuvi' | 'calendar' | 'battrach' | 'iching' | 'bazi' | 'qimen' | 'astrology' | 'sky' | 'numerology' | 'natal' | 'dreams' | 'ai' | 'profiles' | 'plans' | 'settings' | 'admin';

type ProfileDraft = {
  id: string;
  name: string;
  gender: 'female' | 'male';
  birthDate: string;
  birthTime: string;
  birthPlace: string;
};

const navItems: Array<{ id: AppSection; label: string; mark: string }> = [
  { id: 'dashboard', label: 'Tổng quan', mark: '⌂' },
  { id: 'totalfortune', label: 'Tổng Vận VIP', mark: '◇' },
  { id: 'vantam', label: 'Vấn Tâm', mark: '♠' },
  { id: 'tuvi', label: 'Tử Vi', mark: '✦' },
  { id: 'calendar', label: 'Phong thủy ngày', mark: '◷' },
  { id: 'battrach', label: 'Bát Trạch', mark: '⌂' },
  { id: 'iching', label: 'Kinh Dịch', mark: '☷' },
  { id: 'bazi', label: 'Bát Tự', mark: '✣' },
  { id: 'qimen', label: 'Kỳ Môn Độn Giáp', mark: '⊹' },
  { id: 'astrology', label: 'Chiêm tinh', mark: '✧' },
  { id: 'sky', label: 'Huyền Thiên Bàn', mark: '✦' },
  { id: 'numerology', label: 'Thần số học', mark: '№' },
  { id: 'natal', label: 'Bản đồ sao', mark: '◎' },
  { id: 'dreams', label: 'Giải mã giấc mơ', mark: '☾' },
  { id: 'ai', label: 'Hỏi huyền học', mark: '✦' },
  { id: 'profiles', label: 'Hồ sơ', mark: '人' },
  { id: 'plans', label: 'Gói dịch vụ', mark: '◇' },
  { id: 'settings', label: 'Cài đặt', mark: '⚙' },
  { id: 'admin', label: 'Quản trị', mark: '盾' },
];

function Dashboard({ onNavigate }: { onNavigate: (section: AppSection) => void }) {
  const cards: Array<{ id: AppSection; eyebrow: string; title: string; desc: string; status: string }> = [
    { id: 'vantam', eyebrow: 'BÀI TÂY 32 LÁ', title: 'Vấn Tâm', desc: 'Trải 4 lá mồi và bàn 28 lá, lật bài theo nhịp bạn chọn.', status: '' },
    { id: 'tuvi', eyebrow: 'MỆNH BÀN', title: 'Lập lá số Tử Vi', desc: '12 cung, Tam phương Tứ chính, Đại vận, Tiểu hạn, Lưu niên và vòng tháng.', status: 'Đang hoạt động' },
    { id: 'calendar', eyebrow: 'LỊCH NGÀY', title: 'Phong thủy hôm nay', desc: 'Can Chi, giờ tốt, màu sắc, phương vị và việc nên làm.', status: 'Đang khóa rule' },
    { id: 'battrach', eyebrow: 'NHÀ Ở', title: 'Bát Trạch', desc: 'Mệnh quái, Đông/Tây tứ mệnh và tám phương vị cho nhà ở.', status: 'Đang kiểm chứng công thức' },
    { id: 'iching', eyebrow: 'DỊCH HỌC', title: 'Kinh Dịch', desc: 'Lập quẻ Mai Hoa bằng số hoặc ngày giờ, có quẻ chủ, hào động và quẻ biến.', status: 'Đã tính cơ bản' },
    { id: 'bazi', eyebrow: 'TỨ TRỤ', title: 'Bát Tự', desc: 'Lập bốn trụ, Nhật chủ, tàng can, Thập thần và thống kê ngũ hành tách lớp.', status: 'Chỉ chạy công thức đã kiểm chứng' },
    { id: 'qimen', eyebrow: 'TAM THỨC', title: 'Kỳ Môn Độn Giáp', desc: 'Thời gia Kỳ Môn: tiết khí, Tam nguyên, 18 cục, Tam kỳ Lục nghi, Trực Phù và Trực Sử.', status: 'Công thức lõi đã kiểm chứng' },
    { id: 'astrology', eyebrow: 'CHIÊM TINH', title: 'Vị trí hành tinh', desc: 'Tính Mặt Trời, Mặt Trăng và các hành tinh theo hoàng đạo nhiệt đới.', status: 'Đã có ephemeris' },
    { id: 'sky', eyebrow: 'THIÊN TƯỢNG', title: 'Huyền Thiên Tinh Bàn', desc: 'GPS + hướng quay mặt để xác định vùng trời, chòm sao và thiên thể phía trước.', status: 'Đã tính theo vị trí thật' },
    { id: 'numerology', eyebrow: 'CON SỐ', title: 'Thần số học', desc: 'Đường đời, ngày sinh, thái độ, sứ mệnh, linh hồn và nhân cách.', status: 'Hệ Pythagoras' },
    { id: 'natal', eyebrow: 'NATAL CHART', title: 'Bản đồ sao', desc: 'Dựng vòng hoàng đạo cá nhân từ ngày, giờ sinh và múi giờ.', status: 'Chưa bật hệ nhà' },
    { id: 'dreams', eyebrow: 'DREAM LAB', title: 'Giải mã giấc mơ', desc: 'Kể lại giấc mơ và phân tích tách lớp: tâm lý hiện đại, neuroscience, Jung và Freud.', status: 'Phân tích có giới hạn' },
    { id: 'ai', eyebrow: 'TRỢ LÝ', title: 'Hỏi huyền học', desc: 'Điểm vào cho Tử Vi, Bát Tự, Kinh Dịch, Chiêm tinh, Thần số học và kho kiến thức.', status: 'Chưa bật AI' },
  ];

  return (
    <main className="workspace dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">TRUNG TÂM HUYỀN HỌC</p>
          <h1>Hôm nay bạn muốn xem gì?</h1>

        </div>

      </section>
      <section className="dashboard-grid">
        {cards.map(card => (
          <button className="feature-card" key={card.id} onClick={() => onNavigate(card.id)}>
            <span className="feature-eyebrow">{card.eyebrow}</span><strong>{card.title}</strong><p>{card.desc}</p>
          </button>
        ))}
      </section>

    </main>
  );
}

const vanTamSuits = [{name:'Cơ',symbol:'♥'},{name:'Rô',symbol:'♦'},{name:'Bích',symbol:'♠'},{name:'Tép',symbol:'♣'}];
const vanTamRanks = ['7','8','9','10','J','Q','K','A'];
const vanTamPositionRanks = ['8','9','10','J','Q','K','A'];
const vanTamSpiral = [[1,2,3,4,5,6,7],[18,19,20,21,22,23,8],[17,28,27,26,25,24,9],[16,15,14,13,12,11,10]];
type VanTamCard = { id:string; rank:string; suit:string; symbol:string };
type VanTamCell = { suit:string; positionRank:string; order:number; card:VanTamCard; revealed:boolean };
function makeVanTamDeck():VanTamCard[]{ return vanTamSuits.flatMap(s=>vanTamRanks.map(rank=>({id:`${s.name}-${rank}`,rank,suit:s.name,symbol:s.symbol}))); }
function shuffleVanTamPass(cards:VanTamCard[]){ const out=[...cards]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; }
function shuffleVanTam(cards:VanTamCard[],times:number){ let out=[...cards]; for(let i=0;i<times;i++) out=shuffleVanTamPass(out); return out; }
function VanTamPage() {
  const today=new Date();
  const [question,setQuestion]=useState('');
  const [gender,setGender]=useState<'Nam'|'Nữ'>('Nữ');
  const [lunarDay,setLunarDay]=useState(Math.max(1,Math.min(30,today.getDate())));
  const [cells,setCells]=useState<VanTamCell[]>([]);
  const [baits,setBaits]=useState<Array<{card:VanTamCard;revealed:boolean}>>([]);
  const [started,setStarted]=useState(false);
  const [finished,setFinished]=useState(false);
  const [sevens,setSevens]=useState<VanTamCard[]>([]);
  const shuffleCount=lunarDay<10?(gender==='Nam'?7:9):lunarDay;
  function newSpread(){ const deck=shuffleVanTam(makeVanTamDeck(),shuffleCount); const nextCells:VanTamCell[]=[]; const nextBaits:Array<{card:VanTamCard;revealed:boolean}>=[]; for(let row=0;row<4;row++){const base=row*8;for(let col=0;col<7;col++)nextCells.push({suit:vanTamSuits[row].name,positionRank:vanTamPositionRanks[col],order:vanTamSpiral[row][col],card:deck[base+col],revealed:false});nextBaits.push({card:deck[base+7],revealed:false});} setCells(nextCells);setBaits(nextBaits);setStarted(true);setFinished(false);setSevens([]); }
  function runSpread(){ if(!started||finished)return; const c=cells.map(x=>({...x})); const b=baits.map(x=>({...x})); const found:VanTamCard[]=[]; let done=false; const collect=(card:VanTamCard)=>{if(card.rank==='7'&&!found.some(x=>x.id===card.id)){found.push(card);if(found.length===4)done=true;}}; const reveal=(cell:VanTamCell)=>{if(cell.revealed||done)return;cell.revealed=true;collect(cell.card);}; const follow=(suit:string)=>{let rank='8';const visited=new Set<string>();while(!done){const key=`${suit}-${rank}`;if(visited.has(key))break;visited.add(key);const cell=c.find(x=>x.suit===suit&&x.positionRank===rank);if(!cell)break;reveal(cell);if(done||cell.card.rank==='7'||cell.card.suit!==suit||!vanTamPositionRanks.includes(cell.card.rank))break;rank=cell.card.rank;}}; const baitEights:VanTamCard[]=[]; for(const bait of b){if(done)break;bait.revealed=true;collect(bait.card);if(bait.card.rank==='8')baitEights.push(bait.card);} for(const card of baitEights){if(done)break;follow(card.suit);} for(let order=1;order<=28&&!done;order++){const cell=c.find(x=>x.order===order);if(cell&&!cell.revealed)reveal(cell);} setCells(c);setBaits(b);setSevens(found);setFinished(true); }
  const missing=[...baits.filter(x=>!x.revealed).map(x=>({card:x.card,where:'lá mồi'})),...cells.filter(x=>!x.revealed).map(x=>({card:x.card,where:`ô ${x.order} · ${x.suit} ${x.positionRank}`}))];
  return <main className='workspace module-page vantam-page'><header className='module-header'><p className='eyebrow'>BÀI TÂY 32 LÁ</p><h1>Vấn Tâm</h1><p>Nhập câu hỏi và chọn giới tính. Hệ thống chia đúng 7 lá bàn + 1 lá mồi, lặp 4 lần.</p></header><section className='vantam-question'><label>Câu hỏi của bạn<input value={question} onChange={e=>setQuestion(e.target.value)} placeholder='Nhập câu hỏi cần xem'/></label><label>Giới tính<select value={gender} onChange={e=>setGender(e.target.value as 'Nam'|'Nữ')}><option>Nam</option><option>Nữ</option></select></label><label>Ngày âm<input type='number' min='1' max='30' value={lunarDay} onChange={e=>setLunarDay(Math.max(1,Math.min(30,Number(e.target.value)||1)))}/></label><div><small>Số lần tráo</small><strong>{shuffleCount} lần</strong></div><button className='secondary-action' onClick={newSpread}>TRẢI BÀI MỚI</button><button className='primary-action' disabled={!started||finished} onClick={runSpread}>CHẠY TRẢI BÀI</button></section>{started&&<><section className='vantam-section'><div className='vantam-heading'><div><span className='feature-eyebrow'>4 LÁ MỒI</span><h2>Mồi</h2></div></div><div className='vantam-seeds'>{baits.map((slot,i)=><div key={i} className={slot.revealed?'vantam-card open':'vantam-card'}><small>Mồi {i+1}</small><strong>{slot.revealed?`${slot.card.rank}${slot.card.symbol}`:'✦'}</strong></div>)}</div></section><section className='vantam-section'><div className='vantam-heading'><div><span className='feature-eyebrow'>BÀN 28 Ô</span><h2>Đường lật xoắn 1 → 28</h2></div></div><div className='vantam-board'>{cells.sort((a,b)=>a.order-b.order).map(cell=><div key={cell.order} className={cell.revealed?'vantam-card open':'vantam-card'}><small>{cell.order}</small><strong>{cell.revealed?`${cell.card.rank}${cell.card.symbol}`:'✦'}</strong></div>)}</div></section><section className='vantam-missing'><div><span className='feature-eyebrow'>KẾT QUẢ TRẢI</span><h2>{sevens.length}/4 lá 7 · {missing.length} lá chưa lật</h2></div>{finished&&<div>{missing.length===0?<span>Không còn lá chưa lật.</span>:missing.map(x=><span key={x.card.id}>{x.card.rank}{x.card.symbol} — {x.where}</span>)}</div>}</section></>}</main>;
}

function RuleLockedPage({ title, kicker, description, children }: { title: string; kicker: string; description: string; children?: ReactNode }) {
  return (
    <main className="workspace module-page">
      <header className="module-header"><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{description}</p></header>
      {children}
      <section className="rule-lock-card"><span className="lock-icon">◇</span><div><strong>Chưa đủ công thức đã kiểm chứng để chạy kết quả</strong><p>Phần này chỉ được bật khi công thức đã được đối chiếu theo sách và vượt bộ test. Hệ thống không dùng công thức đoán tạm.</p></div></section>
    </main>
  );
}

function CalendarPage() {
  const todayValue = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset()*60000); return local.toISOString().slice(0,10); };
  const [date,setDate] = useState(todayValue);
  const [result,setResult] = useState<null | { lunar:string; dayGanZhi:string; deity:string; deityType:string; deityLuck:string; yi:string[]; ji:string[]; cai:string; xi:string; fu:string; chong:string; sha:string; xiu:string; xiuLuck:string }>(null);
  const [error,setError] = useState('');

  function calculate(target = date) {
    try {
      if (!target) throw new Error('Chọn ngày cần xem.');
      const [year,month,day] = target.split('-').map(Number); const lunar = Solar.fromYmd(year,month,day).getLunar();
      setResult({ lunar:lunar.toString(),dayGanZhi:viGanZhi(lunar.getDayInGanZhi()),deity:lunar.getDayTianShen(),deityType:lunar.getDayTianShenType(),deityLuck:lunar.getDayTianShenLuck(),yi:lunar.getDayYi(),ji:lunar.getDayJi(),cai:lunar.getDayPositionCaiDesc(),xi:lunar.getDayPositionXiDesc(),fu:lunar.getDayPositionFuDesc(),chong:lunar.getChongDesc(),sha:lunar.getSha(),xiu:lunar.getXiu(),xiuLuck:lunar.getXiuLuck() });
      setError('');
    } catch (err) { setResult(null); setError(err instanceof Error ? err.message : 'Không thể tính ngày.'); }
  }

  function chooseOffset(days:number) { const now = new Date(); now.setDate(now.getDate()+days); const local = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10); setDate(local); calculate(local); }

  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">LỊCH · CAN CHI · HOÀNG HẮC ĐẠO</p><h1>Phong thủy ngày</h1><p>Ngày nhập được tính trực tiếp bằng lịch Can Chi; màu cá nhân và chọn việc chuyên sâu vẫn chờ rule riêng.</p></header>
    <section className="tool-grid">
      <article className="tool-panel"><DateDMYInput label="Ngày cần xem" value={date} onChange={setDate}/><div className="chip-row"><button onClick={() => chooseOffset(0)}>Hôm nay</button><button onClick={() => chooseOffset(1)}>Ngày mai</button><button onClick={() => calculate()}>Xem ngày</button></div>{error && <div className="error">{error}</div>}</article>
      <article className="result-panel calendar-result">{!result ? <div className="empty-list">Chọn ngày rồi bấm “Xem ngày”.</div> : <><div className="calendar-head"><span>{formatDateDMY(date)}</span><h2>{result.dayGanZhi}</h2><p>{result.lunar}</p></div><div className="calendar-facts"><div><small>Trực thần ngày</small><b>{result.deity} · {result.deityType} · {result.deityLuck}</b></div><div><small>Nhị thập bát tú</small><b>{result.xiu} · {result.xiuLuck}</b></div><div><small>Hỷ thần</small><b>{result.xi}</b></div><div><small>Tài thần</small><b>{result.cai}</b></div><div><small>Phúc thần</small><b>{result.fu}</b></div><div><small>冲 / sát</small><b>{result.chong} · {result.sha}</b></div></div><div className="yi-ji-grid"><div><strong>NÊN</strong><p>{result.yi.join(' · ') || '—'}</p></div><div><strong>TRÁNH</strong><p>{result.ji.join(' · ') || '—'}</p></div></div></>}</article>
    </section>
  </main>;
}

type FengShuiSource = { id:string; viTitle:string; zhTitle:string; layer:string; use:string; status:string; url?:string };

const fengShuiChinaSources: FengShuiSource[] = [
  { id:'FS-CN-01', viTitle:'Hoàng Đế Trạch Kinh', zhTitle:'《黄帝宅经》', layer:'Dương trạch cổ điển', use:'Âm dương trạch · nền lý luận nhà ở', status:'Đã đăng ký nguồn Trung Quốc' },
  { id:'FS-CN-02', viTitle:'Táng Thư', zhTitle:'《葬书》', layer:'Hình thế / khí', use:'Khí · thế đất · âm trạch · nền tảng khái niệm phong thủy', status:'Đã đăng ký; tác giả truyền thống quy Quách Phác, cần giữ chú thích bản truyền' },
  { id:'FS-CN-03', viTitle:'Thanh Nang Kinh', zhTitle:'《青囊经》', layer:'Lý khí cổ điển', use:'Âm dương · phối hợp sơn thủy · nền lý khí', status:'Đã đăng ký; cần đối chiếu bản cổ' },
  { id:'FS-CN-04', viTitle:'Thanh Nang Tự', zhTitle:'《青囊序》', layer:'Lý khí cổ điển', use:'Âm dương thuận nghịch · sơn thủy · truyền thống Thanh Nang', status:'Đã đăng ký; cần đối chiếu bản cổ' },
  { id:'FS-CN-05', viTitle:'Thanh Nang Áo Ngữ', zhTitle:'《青囊奥语》', layer:'Lý khí / huyền không', use:'Khẩu quyết lý khí · âm dương · quái khí', status:'Đã đăng ký; chưa trộn vào rule production' },
  { id:'FS-CN-06', viTitle:'Thiên Ngọc Kinh', zhTitle:'《天玉经》', layer:'Tam Nguyên / Huyền Không', use:'Quái lý · nguyên vận · lý khí huyền không', status:'Đã đăng ký; tách riêng khỏi Bát Trạch' },
  { id:'FS-CN-07', viTitle:'Hám Long Kinh', zhTitle:'《撼龙经》', layer:'Loan đầu / hình thế', use:'Long mạch · cửu tinh · thế núi', status:'Đã có bản Trung Quốc để đối chiếu', url:'https://ctext.org/wiki.pl?if=gb&res=739860' },
  { id:'FS-CN-08', viTitle:'Nghi Long Kinh', zhTitle:'《疑龙经》', layer:'Loan đầu / hình thế', use:'Biện long · huyệt · chủ khách · hình thế', status:'Đã có bản Trung Quốc để đối chiếu', url:'https://zh.wikisource.org/zh-hans/%E6%92%BC%E9%BE%8D%E7%B6%93/%E7%96%91%E9%BE%8D%E7%B6%93/%E7%96%91%E9%BE%8D%E5%8D%81%E5%95%8F' },
  { id:'FS-CN-09', viTitle:'Tuyết Tâm Phú', zhTitle:'《雪心赋》', layer:'Loan đầu / hình thế', use:'Long · huyệt · sa · thủy · minh đường', status:'Đã đăng ký nguồn Trung Quốc' },
  { id:'FS-CN-10', viTitle:'Phát Vi Luận', zhTitle:'《发微论》', layer:'Lý luận địa lý', use:'Khí · thế · hình · lý luận phong thủy', status:'Đã đăng ký; đang chốt bản đối chiếu' },
  { id:'FS-CN-11', viTitle:'Quản Thị Địa Lý Chỉ Mông', zhTitle:'《管氏地理指蒙》', layer:'Địa lý tổng hợp', use:'Loan đầu · địa lý · nhận thế đất', status:'Đã đăng ký; đang chốt bản đối chiếu' },
  { id:'FS-CN-12', viTitle:'Địa Lý Nhân Tử Tu Tri', zhTitle:'《地理人子须知》', layer:'Địa lý tổng hợp', use:'Long · huyệt · sa · thủy · hướng · thực hành', status:'Đã đăng ký nguồn Trung Quốc' },
  { id:'FS-CN-13', viTitle:'Địa Lý Đại Toàn', zhTitle:'《地理大全》', layer:'Tổng tập phong thủy', use:'Tập hợp nhiều hệ địa lý và phương pháp', status:'Đã đăng ký; phải tách chương theo trường phái' },
  { id:'FS-CN-14', viTitle:'Dương Trạch Thập Thư', zhTitle:'《阳宅十书》', layer:'Dương trạch', use:'Nhà ở · cửa · bếp · phòng · bố cục dương trạch', status:'Đã đăng ký nguồn Trung Quốc' },
  { id:'FS-CN-15', viTitle:'Địa Lý Ngũ Quyết', zhTitle:'《地理五诀》', layer:'Tam Hợp / địa lý thực hành', use:'Long · huyệt · sa · thủy · hướng · 24 sơn', status:'Đã có bản khắc Thanh để đối chiếu', url:'https://commons.wikimedia.org/wiki/File:NLC892-GBZX0301012647-289343_%E9%99%BD%E5%AE%85%E4%B8%89%E8%A6%81%E5%9C%B0%E7%90%86%E4%BA%94%E8%A8%A3_%E5%85%AB%E5%8D%B7_%E7%AC%AC1%E5%86%8A.pdf' },
  { id:'FS-CN-16', viTitle:'Địa Lý Biện Chính', zhTitle:'《地理辨正》', layer:'Tam Nguyên / Huyền Không', use:'Hiệu đính và biện giải hệ Thanh Nang · Thiên Ngọc · lý khí', status:'Đã đăng ký; tách riêng khỏi Tam Hợp/Bát Trạch' },
  { id:'FS-CN-17', viTitle:'Nhập Địa Nhãn Toàn Thư', zhTitle:'《入地眼全书》', layer:'Địa lý thực hành', use:'Nhận long · định huyệt · sa thủy · thực hành địa lý', status:'Đã đăng ký nguồn Trung Quốc' },
  { id:'FS-CN-18', viTitle:'Bát Trạch Minh Kính', zhTitle:'《八宅明镜》', layer:'Bát Trạch / Dương trạch', use:'Mệnh quái · Đông/Tây tứ mệnh · tám phương cát hung', status:'Nguồn lõi cho module Bát Trạch; cần khóa bản và rule' },
  { id:'FS-CN-19', viTitle:'Dương Trạch Tam Yếu', zhTitle:'《阳宅三要》', layer:'Dương trạch / Bát Trạch', use:'Môn · Chủ · Táo và phối hợp dương trạch', status:'Đã có bản khắc Thanh để đối chiếu', url:'https://commons.wikimedia.org/wiki/File:NLC892-GBZX0301012647-289343_%E9%99%BD%E5%AE%85%E4%B8%89%E8%A6%81%E5%9C%B0%E7%90%86%E4%BA%94%E8%A8%A3_%E5%85%AB%E5%8D%B7_%E7%AC%AC1%E5%86%8A.pdf' },
];

function FengShuiSourceRegistry() {
  const groups = ['Bát Trạch / Dương trạch','Loan đầu / hình thế','Lý khí / Tam Nguyên / Huyền Không','Địa lý tổng hợp / thực hành'];
  const groupFor = (source:FengShuiSource) => {
    if (/Bát Trạch|Dương trạch/.test(source.layer)) return 'Bát Trạch / Dương trạch';
    if (/Loan đầu|Hình thế|hình thế/.test(source.layer)) return 'Loan đầu / hình thế';
    if (/Lý khí|Tam Nguyên|Huyền Không/.test(source.layer)) return 'Lý khí / Tam Nguyên / Huyền Không';
    return 'Địa lý tổng hợp / thực hành';
  };
  return <section className="bazi-source-section fengshui-source-section">
    <div className="bazi-source-head"><div><span className="feature-eyebrow">NGUỒN PHONG THỦY TRUNG QUỐC</span><h2>Kho sách Phong Thủy đã Việt hóa</h2></div><b>{fengShuiChinaSources.length} nguồn</b></div>
    <p className="bazi-source-intro">Tên hiển thị được Việt hóa nhưng luôn giữ tên Hán văn. Bát Trạch, Loan đầu, Tam Hợp và Tam Nguyên/Huyền Không không được trộn thành một công thức duy nhất.</p>
    {groups.map(group => <div className="fengshui-source-group" key={group}><h3>{group}</h3><div className="bazi-source-grid">{fengShuiChinaSources.filter(source => groupFor(source) === group).map(source => <article className="bazi-source-card" key={source.id}>
      <div className="bazi-source-title"><span>{source.id}</span><h3>{source.viTitle}</h3><small>{source.zhTitle}</small></div>
      <dl><div><dt>Lớp</dt><dd>{source.layer}</dd></div><div><dt>Dùng cho</dt><dd>{source.use}</dd></div><div><dt>Trạng thái</dt><dd>{source.status}</dd></div></dl>
      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Mở nguồn Trung Quốc ↗</a>}
    </article>)}</div></div>)}
    <div className="source-policy"><strong>Quy tắc nguồn:</strong> Chỉ những rule đã đối chiếu đúng sách/bản và có test mới được phép đi vào Calculation Engine. Các trường phái xung đột phải hiện rõ nguồn và không âm thầm hợp nhất.</div>
  </section>;
}

function BatTrachPage() {
  const [birthDate,setBirthDate] = useState(''); const [gender,setGender] = useState<'female'|'male'>('female'); const [viewDate,setViewDate] = useState('');
  const [houseDirection,setHouseDirection] = useState(''); const [doorDirection,setDoorDirection] = useState(''); const [bedDirection,setBedDirection] = useState(''); const [deskDirection,setDeskDirection] = useState(''); const [stoveDirection,setStoveDirection] = useState('');
  const directionOptions = ['Bắc','Đông Bắc','Đông','Đông Nam','Nam','Tây Nam','Tây','Tây Bắc']; const activeDirection = houseDirection || 'Bắc';
  return (
    <RuleLockedPage title="Bát Trạch" kicker="MỆNH QUÁI · TÁM HƯỚNG" description="Nhập đủ dữ liệu người và không gian trước; kết quả cát/hung chỉ bật khi công thức đã được kiểm chứng đầy đủ.">
      <section className="calc-layout"><article className="tool-panel calc-form">
        <DateDMYInput label="Ngày sinh" value={birthDate} onChange={setBirthDate}/>
        <label>Giới tính<select value={gender} onChange={event => setGender(event.target.value as 'female'|'male')}><option value="female">Nữ</option><option value="male">Nam</option></select></label>
        <DateDMYInput label="Ngày muốn xem" value={viewDate} onChange={setViewDate}/>
        <label>Hướng nhà<select value={houseDirection} onChange={event => setHouseDirection(event.target.value)}><option value="">Chưa chọn</option>{directionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Hướng cửa chính<select value={doorDirection} onChange={event => setDoorDirection(event.target.value)}><option value="">Chưa chọn</option>{directionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Hướng giường<select value={bedDirection} onChange={event => setBedDirection(event.target.value)}><option value="">Chưa chọn</option>{directionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Hướng bàn làm việc<select value={deskDirection} onChange={event => setDeskDirection(event.target.value)}><option value="">Chưa chọn</option>{directionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Hướng bếp<select value={stoveDirection} onChange={event => setStoveDirection(event.target.value)}><option value="">Chưa chọn</option>{directionOptions.map(item => <option key={item}>{item}</option>)}</select></label>
      </article><article className="compass-card" aria-label="Sơ đồ tám hướng"><div className="compass-grid">{['Tây Bắc','Bắc','Đông Bắc','Tây','NHÀ','Đông','Tây Nam','Nam','Đông Nam'].map(item => <span className={item === activeDirection ? 'active' : ''} key={item}>{item}</span>)}</div><div className="direction-summary"><span>{birthDate ? formatDateDMY(birthDate) : 'Chưa nhập ngày sinh'} · {gender === 'female' ? 'Nữ' : 'Nam'}</span><span>Nhà: {houseDirection || '—'} · Cửa: {doorDirection || '—'}</span><span>Giường: {bedDirection || '—'} · Bàn: {deskDirection || '—'} · Bếp: {stoveDirection || '—'}</span><span>Ngày xem: {viewDate ? formatDateDMY(viewDate) : '—'}</span></div></article></section>
      <FengShuiSourceRegistry/>
    </RuleLockedPage>
  );
}

function AiPage() {
  return (
    <RuleLockedPage title="Hỏi huyền học" kicker="ROUTER · RULE · DIỄN GIẢI" description="Sau khi engine được khóa, câu hỏi sẽ tự chuyển đến Tử Vi, lịch ngày, Bát Trạch hoặc kho kiến thức.">
      <section className="chat-shell"><div className="chat-intro"><strong>AI chưa được bật ở phase giao diện.</strong><p>Điều này ngăn hệ thống luận trên dữ liệu chưa xác minh.</p></div><div className="chat-compose"><input disabled placeholder="Nhập câu hỏi sau khi module AI được bật…"/><button disabled>Gửi</button></div></section>
    </RuleLockedPage>
  );
}

function readProfiles(): ProfileDraft[] {
  try {
    const raw = window.localStorage.getItem('metaphysics.profiles');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProfileDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileDraft[]>(readProfiles);
  const [draft, setDraft] = useState<Omit<ProfileDraft, 'id'>>({ name:'', gender:'female', birthDate:'', birthTime:'', birthPlace:'' });
  const [message, setMessage] = useState('');

  function saveProfile() {
    if (!draft.name.trim() || !draft.birthDate) { setMessage('Cần ít nhất tên hồ sơ và ngày sinh.'); return; }
    const next: ProfileDraft[] = [{ ...draft, id: String(Date.now()) }, ...profiles].slice(0, 30);
    localStorage.setItem('metaphysics.profiles', JSON.stringify(next));
    setProfiles(next);
    setDraft({ name:'', gender:'female', birthDate:'', birthTime:'', birthPlace:'' });
    setMessage('Đã lưu hồ sơ trên trình duyệt này.');
  }

  function removeProfile(id: string) {
    const next = profiles.filter(profile => profile.id !== id);
    localStorage.setItem('metaphysics.profiles', JSON.stringify(next));
    setProfiles(next);
  }

  return (
    <main className="workspace module-page">
      <header className="module-header"><p className="eyebrow">HỒ SƠ CÁ NHÂN</p><h1>Hồ sơ đã lưu</h1><p>Không có dữ liệu mẫu. Chỉ những hồ sơ bạn tự nhập mới được lưu.</p></header>
      <section className="profile-layout">
        <article className="tool-panel profile-form">
          <label>Tên hồ sơ<input placeholder="Ví dụ: Tôi / Khách A" value={draft.name} onChange={event => setDraft({...draft, name:event.target.value})}/></label>
          <label>Giới tính<select value={draft.gender} onChange={event => setDraft({...draft, gender:event.target.value as 'female'|'male'})}><option value="female">Nữ</option><option value="male">Nam</option></select></label>
          <DateDMYInput label="Ngày sinh" value={draft.birthDate} onChange={birthDate => setDraft({...draft,birthDate})}/>
          <Time24Input label="Giờ sinh" value={draft.birthTime} onChange={birthTime => setDraft({...draft,birthTime})}/>
          <label>Nơi sinh<input placeholder="Tỉnh / thành phố" value={draft.birthPlace} onChange={event => setDraft({...draft, birthPlace:event.target.value})}/></label>
          <button className="primary-action" onClick={saveProfile}>Lưu hồ sơ</button>{message && <p className="form-message">{message}</p>}
        </article>
        <section className="profile-list">
          {profiles.length === 0 ? <div className="empty-list">Chưa có hồ sơ nào.</div> : profiles.map(profile => (
            <article className="profile-card" key={profile.id}><div><strong>{profile.name}</strong><span>{profile.gender === 'female' ? 'Nữ' : 'Nam'} · {formatDateDMY(profile.birthDate)}{profile.birthTime ? ' · ' + profile.birthTime : ''}</span><small>{profile.birthPlace || 'Chưa ghi nơi sinh'}</small></div><button onClick={() => removeProfile(profile.id)}>Xóa</button></article>
          ))}
        </section>
      </section>
    </main>
  );
}

type AccessInfo = { webId:string; role:'free'|'vip'|'admin'; plan:string; enabled:boolean; active:boolean; startsAt:string; expiresAt:string|null; email?:string; name?:string };
const planLabels: Record<string,string> = { FREE:'Free',NHAN_HOA:'Nhân Hòa',NHAT_VAN:'Nhật Vận',DIA_LOI:'Địa Lợi',THIEN_THOI:'Thiên Thời',SONG_MENH:'Song Mệnh',TOAN_DIEN:'Toàn Diện',PREMIUM:'Thiên Thời · Địa Lợi · Nhân Hòa' };
const planCards = [
  {id:'NHAN_HOA',name:'Nhân Hòa',note:'Bài Tây',price:'299.000đ',desc:'Rule: tình huống & con người · Không mở Tử Vi/Bát Tự/Nhật Vận.'},
  {id:'NHAT_VAN',name:'Nhật Vận',note:'',price:'499.000đ',desc:'Rule: thời điểm hành động · dữ liệu ngày, Can Chi, việc nên/tránh và phương vị đã tính.'},
  {id:'DIA_LOI',name:'Địa Lợi',note:'Tử Vi',price:'799.000đ',desc:'Rule Tử Vi: Mệnh/Thân, 12 cung, sao, tam phương tứ chính, Tứ Hóa và vận đã hiển thị.'},
  {id:'THIEN_THOI',name:'Thiên Thời',note:'Bát Tự',price:'899.000đ',desc:'Rule Bát Tự: Tứ Trụ, Nhật chủ, Nguyệt lệnh, Thập thần, tàng can và vận khí đã khóa.'},
  {id:'SONG_MENH',name:'Song Mệnh',note:'COMBO',price:'1.290.000đ',desc:'Địa Lợi + Thiên Thời · thêm rule đối chiếu hai hệ, không trộn phép tính.'},
  {id:'TOAN_DIEN',name:'Toàn Diện',note:'KHUYÊN DÙNG',price:'1.690.000đ',desc:'Nhân Hòa + Nhật Vận + Địa Lợi + Thiên Thời · tổng hợp sau khi luận riêng từng hệ.'},
  {id:'PREMIUM',name:'Thiên Thời · Địa Lợi · Nhân Hòa',note:'CAO CẤP',price:'2.490.000đ',desc:'Toàn bộ rule hiện có + đa hệ, nhiều hồ sơ, tương hợp, chọn ngày giờ và báo cáo nâng cao.'}
];
function PlansPage({ access, onSignIn }:{ access:AccessInfo|null; onSignIn:()=>void }) {
  return <main className="workspace module-page"><header className="module-header"><p className="eyebrow">THIÊN THỜI · ĐỊA LỢI · NHÂN HÒA</p><h1>Bảng giá dịch vụ</h1><p>Free được dùng các công cụ lập/tính như lá số Tử Vi và lập quẻ Kinh Dịch. Phần luận giải chuyên sâu được mở theo đúng gói.</p></header>
    <section className="free-access-card"><div><span>FREE</span><h2>Công cụ tính toán</h2><p>Lập lá số · lập quẻ · xem dữ liệu engine. Không bao gồm luận giải AI.</p></div>{access?<b>ID {access.webId} · {planLabels[access.plan]||access.plan}</b>:<button className="primary-action" onClick={onSignIn}>ĐĂNG NHẬP / NHẬN ID WEB</button>}</section>
    <section className="plan-grid service-pricing">{planCards.map((plan,i)=><article className={plan.id==='TOAN_DIEN'?'plan-card recommended':'plan-card'} key={plan.id}><span>{i<4?'GÓI ĐƠN LẺ':'GÓI COMBO'} · {plan.note}</span><strong>{plan.name}</strong><b>{plan.price}<small> / tháng</small></b><p>{plan.desc}</p>{access?.plan===plan.id?<em>Gói hiện tại</em>:<em>Khóa theo quyền ID</em>}</article>)}</section>
    <section className="core-meaning"><div><b>Nhân Hòa</b><span>Tình huống & con người</span></div><div><b>Nhật Vận</b><span>Thời điểm hành động</span></div><div><b>Địa Lợi</b><span>Đường đời & hoàn cảnh</span></div><div><b>Thiên Thời</b><span>Cấu trúc & thời vận</span></div></section>
  </main>;
}

function SettingsPage() {
  return <main className="workspace module-page"><header className="module-header"><p className="eyebrow">CÀI ĐẶT</p><h1>Trải nghiệm ứng dụng</h1><p>Giọng đọc và trợ lý Live2D sẽ gắn sau, không ảnh hưởng engine.</p></header><section className="settings-list"><div><span>Live2D / Vtube</span><b>Để sau</b></div><div><span>Giọng đọc</span><b>Chưa bật</b></div><div><span>Giảm chuyển động</span><b>Sẽ hỗ trợ</b></div></section></main>;
}

type MindSource = { id:string; title:string; author:string; year:string; layer:string; use:string; status:string; url?:string };

const dreamSources: MindSource[] = [
  { id:'DREAM-01', title:'The Interpretation of Dreams', author:'Sigmund Freud', year:'1900', layer:'Lịch sử phân tâm học', use:'Wish-fulfilment, dream-work, free association; lưu như hệ diễn giải lịch sử, không coi là kết luận khoa học hiện đại.', status:'Toàn văn bản dịch Brill 1913 có nguồn học thuật mở', url:'https://psychclassics.yorku.ca/Freud/Dreams/index.htm' },
  { id:'DREAM-02', title:'Man and His Symbols', author:'C. G. Jung và cộng sự', year:'1964', layer:'Tâm lý học phân tích', use:'Biểu tượng, vô thức, archetype; dùng như truyền thống Jung, tách khỏi bằng chứng thực nghiệm.', status:'Đăng ký thư mục; không sao chép toàn văn' },
  { id:'DREAM-03', title:'Children’s Dreams', author:'C. G. Jung', year:'1936–1940', layer:'Tâm lý học phân tích', use:'Tư liệu lịch sử về giấc mơ trẻ em và cách diễn giải Jung.', status:'Đăng ký thư mục; không sao chép toàn văn' },
  { id:'DREAM-04', title:'The Dreaming Brain', author:'J. Allan Hobson', year:'1988', layer:'Khoa học thần kinh giấc mơ', use:'Nền activation-synthesis và sinh lý thần kinh của mơ.', status:'Đăng ký thư mục; đối chiếu cùng nghiên cứu mới' },
  { id:'DREAM-05', title:'Dreaming: A Very Short Introduction', author:'J. Allan Hobson', year:'2005', layer:'Khoa học giấc ngủ', use:'Tổng quan não bộ, REM, mơ và quan hệ với các lý thuyết phân tâm.', status:'Nguồn Oxford đã xác minh', url:'https://academic.oup.com/book/285' },
  { id:'DREAM-06', title:'The Scientific Study of Dreams', author:'G. William Domhoff', year:'2003', layer:'Nghiên cứu thực nghiệm', use:'Phân tích nội dung, phát triển nhận thức và nghiên cứu định lượng về giấc mơ.', status:'Đăng ký theo DreamResearch/UCSC', url:'https://dreams.ucsc.edu/Library/' },
  { id:'DREAM-07', title:'The Neurocognitive Theory of Dreaming', author:'G. William Domhoff', year:'2022', layer:'Neurocognitive', use:'Neural substrates, cognitive processes, dream content, chức năng và cách dùng văn hóa.', status:'Open Access · MIT Press', url:'https://direct.mit.edu/books/oa-monograph/5401/The-Neurocognitive-Theory-of-DreamingThe-Where-How' },
  { id:'DREAM-08', title:'Dreams, Sleep, and Consciousness', author:'G. William Domhoff', year:'2026', layer:'Neurocognitive / consciousness', use:'Kết nối lý thuyết mơ, giấc ngủ và mô hình ý thức.', status:'Đã xác minh thư mục 2026', url:'https://dreams.ucsc.edu/DSC/' },
];

const psychologySources: MindSource[] = [
  { id:'PSY-01', title:'The Principles of Psychology', author:'William James', year:'1890', layer:'Nền tảng tâm lý học', use:'Ý thức, chú ý, trí nhớ, thói quen, cảm xúc, ý chí và dòng tư tưởng.', status:'Toàn văn học thuật mở · York University', url:'https://psychclassics.yorku.ca/James/Principles/' },
  { id:'PSY-02', title:'Psychology as the Behaviorist Views It', author:'John B. Watson', year:'1913', layer:'Behaviorism', use:'Văn bản nền của hành vi luận; dùng để nhận diện lịch sử trường phái.', status:'Classics in the History of Psychology', url:'https://psychclassics.yorku.ca/Watson/intro.htm' },
  { id:'PSY-03', title:'Cognitive Therapy and the Emotional Disorders', author:'Aaron T. Beck', year:'1976', layer:'CBT / nhận thức', use:'Quan hệ nhận thức–cảm xúc và nền tảng cognitive therapy.', status:'APA liệt kê là sách tâm lý tiêu biểu', url:'https://www.apa.org/ed/precollege/topss/popular-books' },
  { id:'PSY-04', title:'Cognitive Therapy of Depression', author:'A. T. Beck, A. J. Rush, B. F. Shaw, G. Emery', year:'1979', layer:'CBT / trầm cảm', use:'Khung cognitive therapy kinh điển; chỉ dùng tham chiếu giáo dục, không tự chẩn đoán.', status:'APA recommended resource', url:'https://www.apa.org/pubs/videos/4310881' },
  { id:'PSY-05', title:'Anxiety Disorders and Phobias: A Cognitive Perspective', author:'Aaron T. Beck & Gary Emery', year:'1985', layer:'CBT / lo âu', use:'Mô hình nhận thức về lo âu và ám sợ.', status:'APA popular psychology list', url:'https://www.apa.org/ed/precollege/topss/popular-books' },
  { id:'PSY-06', title:'Cognitive Behavior Therapy: Basics and Beyond', author:'Judith S. Beck', year:'2020 · 3rd ed.', layer:'CBT hiện đại', use:'Case conceptualization, cấu trúc trị liệu và kỹ thuật CBT.', status:'APA guideline resource', url:'https://www.apa.org/depression-guideline/resources/adults' },
  { id:'PSY-07', title:'Handbook of Cognitive Behavioral Therapy · Vol. 1', author:'Amy Wenzel & Keith S. Dobson (eds.)', year:'2021', layer:'Evidence-based psychotherapy', use:'Bản đồ CBT, REBT, schema, DBT, ACT, MBCT, metacognitive therapy và ABA.', status:'Nguồn APA Books', url:'https://www.apa.org/pubs/books/handbook-cognitive-behavioral-therapy-vol-1' },
  { id:'PSY-08', title:'Essential Components of Cognitive–Behavior Therapy for Depression', author:'Persons, Davidson & Tompkins', year:'2000', layer:'CBT thực hành', use:'Case formulation, session structure, activity scheduling, thought record và schema change.', status:'Nguồn APA Books', url:'https://www.apa.org/pubs/books/431758A.html' },
];

function MindKnowledgeRegistry() {
  const renderGroup = (title:string, eyebrow:string, sources:MindSource[]) => <section className="mind-source-group"><div className="bazi-source-head"><div><span className="feature-eyebrow">{eyebrow}</span><h2>{title}</h2></div><b>{sources.length} nguồn lõi</b></div><div className="mind-source-grid">{sources.map(source => <article className="mind-source-card" key={source.id}><div className="mind-source-title"><span>{source.id} · {source.year}</span><h3>{source.title}</h3><small>{source.author}</small></div><dl><div><dt>Lớp</dt><dd>{source.layer}</dd></div><div><dt>Dùng cho</dt><dd>{source.use}</dd></div><div><dt>Trạng thái</dt><dd>{source.status}</dd></div></dl>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Mở nguồn ↗</a>}</article>)}</div></section>;
  return <section className="bazi-source-section mind-registry"><div className="bazi-source-head"><div><span className="feature-eyebrow">DREAM · PSYCHOLOGY KNOWLEDGE</span><h2>Giấc mơ & Tâm lý học</h2></div><b>{dreamSources.length + psychologySources.length} nguồn lõi</b></div><p className="bazi-source-intro">Kho này tách ba lớp: truyền thống diễn giải lịch sử, tâm lý học thực nghiệm và khoa học thần kinh. Sách còn bản quyền chỉ lưu thư mục + phạm vi kiến thức, không chép toàn văn. Các lý thuyết Freud/Jung không được tự nâng thành kết luận khoa học hay rule chẩn đoán.</p>{renderGroup('Nghiên cứu & diễn giải giấc mơ','GIẤC MƠ',dreamSources)}{renderGroup('Tâm lý học nền tảng & ứng dụng','TÂM LÝ HỌC',psychologySources)}<div className="source-policy"><strong>Knowledge governance:</strong> nguồn lịch sử được gắn nhãn theo trường phái; nguồn hiện đại ưu tiên sách học thuật, APA, MIT/Oxford và nghiên cứu thực nghiệm. Module tương lai chỉ được diễn giải theo lớp nguồn đã chọn, không chẩn đoán bệnh tâm thần và không biến biểu tượng giấc mơ thành tiên đoán chắc chắn.</div></section>;
}

type DreamAnalysis = { summary:string; elements:string[]; emotions:string[]; narrative:string; emotionalDynamics:string; symbolContext:string; modern:string; neuroscience:string; jung:string; freud:string; synthesis:string; confidence:string; questions:string[]; caution:string };

function DreamPage() {
  const [dream, setDream] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState<DreamAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function analyzeDream() {
    if (dream.trim().length < 20) {
      setMessage('Bà kể giấc mơ chi tiết thêm một chút nhé — ít nhất khoảng 20 ký tự.');
      return;
    }
    setLoading(true);
    setMessage('');
    setResult(null);
    try {
      const response = await api.post('/api/dreams/analyze', { dream: dream.trim(), context: context.trim() });
      setResult(response.data as DreamAnalysis);
    } catch {
      setMessage('Chưa phân tích được lúc này. Thử lại sau một chút nhé.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="workspace module-page dream-page">
    <header className="module-header"><p className="eyebrow">GIẤC MƠ · TÂM LÝ HỌC</p><h1>Giải mã giấc mơ</h1><p>Kể nguyên giấc mơ như bạn nhớ. Hệ thống phân tích từng lớp và không biến biểu tượng thành lời tiên tri chắc chắn.</p></header>
    <section className="dream-layout">
      <article className="tool-panel dream-form">
        <label>Giấc mơ của bạn<textarea value={dream} onChange={e=>setDream(e.target.value)} rows={11} placeholder="Ví dụ: Tôi đang đi trên một con đường lạ, thấy..."/></label>
        <label>Bối cảnh gần đây <small>Không bắt buộc — công việc, cảm xúc, sự kiện trước khi ngủ...</small><textarea value={context} onChange={e=>setContext(e.target.value)} rows={5} placeholder="Có điều gì gần đây có thể liên quan tới giấc mơ?"/></label>
        <button className="primary-action" onClick={analyzeDream} disabled={loading}>{loading ? 'ĐANG PHÂN TÍCH…' : 'PHÂN TÍCH GIẤC MƠ'}</button>
        {message && <p className="dream-message">{message}</p>}
        <div className="accuracy-note"><strong>Không có “từ điển biểu tượng tuyệt đối”.</strong><p>Cùng một hình ảnh có thể mang ý nghĩa khác nhau tùy người và hoàn cảnh. Freud/Jung được trình bày như các truyền thống diễn giải lịch sử; phần tâm lý hiện đại và neuroscience được tách riêng.</p></div>
      </article>
      <article className="result-panel dream-result">
        {!result ? <div className="empty-chart-state"><span className="empty-symbol">☾</span><strong>Chưa có giấc mơ để phân tích</strong><p>Kết quả sẽ bóc chi tiết, cảm xúc và các giả thuyết theo từng trường phái.</p></div> : <>
          <div className="dream-summary"><span className="feature-eyebrow">TỔNG QUAN</span><h2>{result.summary}</h2></div>
          <div className="dream-tags"><div><b>Chi tiết nổi bật</b>{result.elements.map(x=><span key={x}>{x}</span>)}</div><div><b>Cảm xúc</b>{result.emotions.map(x=><span key={x}>{x}</span>)}</div></div>
          <section className="dream-deep-read"><div><span className="feature-eyebrow">MẠCH GIẤC MƠ</span><h3>Diễn biến & điểm chuyển</h3><p>{result.narrative}</p></div><div><span className="feature-eyebrow">ĐỘNG LỰC CẢM XÚC</span><h3>Cảm xúc đang vận hành thế nào?</h3><p>{result.emotionalDynamics}</p></div><div><span className="feature-eyebrow">BIỂU TƯỢNG TRONG NGỮ CẢNH</span><h3>Không dùng từ điển biểu tượng cứng</h3><p>{result.symbolContext}</p></div></section>
          <section className="dream-layers">
            <div><span>01 · BẰNG CHỨNG HIỆN ĐẠI</span><h3>Tâm lý học</h3><p>{result.modern}</p></div>
            <div><span>02 · NÃO BỘ & GIẤC NGỦ</span><h3>Neuroscience</h3><p>{result.neuroscience}</p></div>
            <div><span>03 · TÂM LÝ HỌC PHÂN TÍCH</span><h3>Góc nhìn Jung</h3><p>{result.jung}</p></div>
            <div><span>04 · PHÂN TÂM HỌC LỊCH SỬ</span><h3>Góc nhìn Freud</h3><p>{result.freud}</p></div>
          </section>
          <section className="dream-synthesis"><span className="feature-eyebrow">ĐIỂM GIAO NHAU</span><h3>Tổng hợp thận trọng</h3><p>{result.synthesis}</p><div className="dream-confidence"><b>Mức chắc chắn</b><p>{result.confidence}</p></div></section>
          {result.questions.length>0 && <section className="dream-questions"><b>Câu hỏi để tự đối chiếu</b>{result.questions.map((q,i)=><p key={q}>{i+1}. {q}</p>)}</section>}
          <p className="dream-caution">{result.caution}</p>
        </>}
      </article>
    </section>
  </main>;
}

type TotalFortuneResult = { daySummary:string; monthSummary:string; convergence:string[]; conflicts:string[]; domains:{title:string;day:string;month:string;sources:string[]}[]; dayFlow:{period:string;analysis:string;sources:string[]}[]; monthMarkers:{period:string;analysis:string;sources:string[]}[]; practical:string[]; limits:string[] };

function TotalFortunePage({access}:{access:AccessInfo}) {
  const now=new Date();
  const [name,setName]=useState('');
  const [gender,setGender]=useState<'female'|'male'>('female');
  const [birthDate,setBirthDate]=useState('');
  const [birthTime,setBirthTime]=useState('');
  const [birthPlace,setBirthPlace]=useState('');
  const [targetDate,setTargetDate]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
  const [latitude,setLatitude]=useState('');
  const [longitude,setLongitude]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<TotalFortuneResult|null>(null);

  useEffect(()=>{
    try {
      const raw=localStorage.getItem('metaphysics.totalfortune.profile');
      if(!raw) return;
      const saved=JSON.parse(raw) as {name?:string;gender?:'female'|'male';birthDate?:string;birthTime?:string;birthPlace?:string;latitude?:string;longitude?:string};
      setName(saved.name||'');
      setGender(saved.gender||'female');
      setBirthDate(saved.birthDate||'');
      setBirthTime(saved.birthTime||'');
      setBirthPlace(saved.birthPlace||'');
      setLatitude(saved.latitude||'');
      setLongitude(saved.longitude||'');
    } catch { /* hồ sơ lỗi thì giữ form trống */ }
  },[]);

  function saveProfile(){
    if(!birthDate||!birthTime){setMessage('Cần nhập đủ ngày sinh và giờ sinh trước khi lưu hồ sơ.');return;}
    localStorage.setItem('metaphysics.totalfortune.profile',JSON.stringify({name,gender,birthDate,birthTime,birthPlace,latitude,longitude}));
    setMessage('Đã lưu hồ sơ Tổng Vận trên thiết bị này.');
  }

  function useLocation(){
    setMessage('');
    if(!navigator.geolocation){setMessage('Thiết bị không hỗ trợ lấy tọa độ. Có thể nhập tay.');return;}
    navigator.geolocation.getCurrentPosition(p=>{setLatitude(p.coords.latitude.toFixed(6));setLongitude(p.coords.longitude.toFixed(6));setMessage('Đã lấy tọa độ hiện tại từ thiết bị.');},()=>setMessage('Không lấy được vị trí. Hãy cấp quyền vị trí hoặc nhập tọa độ tay.'));
  }
  function collectEngineData(){
    const data:Record<string,string>={};
    const labels:Record<string,string>={tuvi:'Tử Vi',calendar:'Nhật vận',bazi:'Bát Tự',qimen:'Kỳ Môn',astrology:'Chiêm tinh',sky:'Huyền Thiên Bàn',numerology:'Thần số học',natal:'Bản đồ sao',battrach:'Bát Trạch',iching:'Kinh Dịch'};
    Object.entries(labels).forEach(([key,label])=>{
      const cached=localStorage.getItem('metaphysics.totalfortune.'+key);
      if(cached) data[label]=cached;
    });
    return data;
  }
  async function analyze(){
    if(!birthDate||!birthTime||!latitude||!longitude){setMessage('Cần đủ ngày giờ sinh và tọa độ hiện tại.');return;}
    const engineData=collectEngineData();
    if(Object.keys(engineData).length===0){setMessage('Chưa có dữ liệu engine đã tính để tổng hợp. Hãy lập các bộ môn trước; Tổng Vận không tự bịa phép tính còn thiếu.');return;}
    setLoading(true);setMessage('');setResult(null);
    try{const r=await api.post('/api/total-fortune',{profile:{name,gender,birthDate,birthTime,birthPlace},targetDate,latitude:Number(latitude),longitude:Number(longitude),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,engineData});setResult(r.data as TotalFortuneResult);}
    catch{setMessage('Không thể tổng hợp. Kiểm tra quyền VIP và dữ liệu các engine.');}
    finally{setLoading(false);}
  }
  return <main className='workspace module-page'>
    <header className='module-header'><p className='eyebrow'>VIP · ĐA HỆ</p><h1>Tổng Vận ngày & tháng</h1><p>Một hồ sơ, một tọa độ hiện tại. Các hệ tính độc lập; lớp này chỉ đối chiếu dữ liệu đã tính rồi mới tổng hợp.</p></header>
    <section className='dashboard-panel'><div className='panel-heading'><div><span className='feature-eyebrow'>HỒ SƠ DUY NHẤT</span><h2>Thông tin để tổng hợp</h2></div><b>{access.role==='admin'?'ADMIN':planLabels[access.plan]||'VIP'}</b></div>
      <div className='form-grid'>
        <label>Họ tên<input value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Giới tính<select value={gender} onChange={e=>setGender(e.target.value as 'female'|'male')}><option value='female'>Nữ</option><option value='male'>Nam</option></select></label>
        <DateDMYInput label='Ngày sinh' value={birthDate} onChange={setBirthDate}/>
        <Time24Input label='Giờ sinh' value={birthTime} onChange={setBirthTime}/>
        <label>Nơi sinh<input value={birthPlace} onChange={e=>setBirthPlace(e.target.value)}/></label>
        <DateDMYInput label='Ngày muốn xem' value={targetDate} onChange={setTargetDate}/>
        <label>Vĩ độ<input inputMode='decimal' value={latitude} onChange={e=>setLatitude(e.target.value)}/></label>
        <label>Kinh độ<input inputMode='decimal' value={longitude} onChange={e=>setLongitude(e.target.value)}/></label>
      </div>
      <div className='action-row' style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:18}}>
        <button className='secondary-button' onClick={useLocation}>⌖ LẤY TỌA ĐỘ HIỆN TẠI</button>
        <button className='secondary-button' onClick={saveProfile}>LƯU HỒ SƠ</button>
        <button className='primary-button' onClick={analyze} disabled={loading}>{loading?'ĐANG ĐỐI CHIẾU…':'TỔNG HỢP NGÀY + THÁNG'}</button>
      </div>
      {message&&<p className='form-note'>{message}</p>}
      {loading&&<p className='form-note'>Đang tính và đối chiếu các lớp dữ liệu… Kết quả sẽ hiện ngay bên dưới.</p>}
    </section>
    {result&&<section className='deep-interpret-result'>
      <article className='deep-overview'><span className='feature-eyebrow'>HÔM NAY</span><p>{result.daySummary}</p></article>
      <article className='deep-overview'><span className='feature-eyebrow'>THÁNG NÀY</span><p>{result.monthSummary}</p></article>
      <div className='deep-pair'><article><span>ĐIỂM ĐỒNG THUẬN</span>{result.convergence.map(x=><p key={x}>• {x}</p>)}</article><article><span>ĐIỂM KHÁC NHAU GIỮA CÁC HỆ</span>{result.conflicts.map(x=><p key={x}>• {x}</p>)}</article></div>
      <div className='deep-domains'>{result.domains.map(x=><article key={x.title}><h3>{x.title}</h3><p><b>Ngày:</b> {x.day}</p><p><b>Tháng:</b> {x.month}</p></article>)}</div>
      {result.dayFlow.length>0&&<article className='dashboard-panel'><h2>Diễn biến trong ngày</h2>{result.dayFlow.map(x=><div className='source-row' key={x.period}><b>{x.period}</b><span>{x.analysis}</span></div>)}</article>}
      {result.monthMarkers.length>0&&<article className='dashboard-panel'><h2>Mốc đáng chú ý trong tháng</h2>{result.monthMarkers.map(x=><div className='source-row' key={x.period}><b>{x.period}</b><span>{x.analysis}</span></div>)}</article>}
      <div className='deep-pair'><article><span>NÊN ƯU TIÊN / LƯU Ý</span>{result.practical.map(x=><p key={x}>• {x}</p>)}</article><article><span>GIỚI HẠN DỮ LIỆU</span>{result.limits.map(x=><p key={x}>• {x}</p>)}</article></div>
    </section>}
  </main>;
}

function AdminPage() {
  const tuviBooks = ['Tử Vi Đẩu Số Tân Biên · 277 trang','Tử Vi Tổng Hợp · 443 trang','Trung Châu Tam Hợp Phái · Quyển 1 · 150 trang','Trung Châu Tam Hợp Phái · Quyển 2 · 150 trang','Trung Châu Tứ Hóa Phái · Quyển 1 · 150 trang','Trung Châu Tứ Hóa Phái · Quyển 2 · 150 trang'];
  const [accounts,setAccounts]=useState<AccessInfo[]>([]);
  const [webId,setWebId]=useState('');
  const [email,setEmail]=useState('');
  const [role,setRole]=useState<'free'|'vip'|'admin'>('vip');
  const [plan,setPlan]=useState('DIA_LOI');
  const [enabled,setEnabled]=useState(true);
  const [expiresAt,setExpiresAt]=useState('');
  const [adminMessage,setAdminMessage]=useState('');

  async function loadAccounts(){
    try{const r=await api.get('/api/admin/access');setAccounts((r.data.items||[]) as AccessInfo[]);}
    catch{setAdminMessage('Không tải được danh sách ID.');}
  }
  useEffect(()=>{loadAccounts();},[]);
  async function saveAccess(){
    setAdminMessage('');
    try{
      await api.put('/api/admin/access',{webId:webId.trim().toUpperCase(),email:email.trim().toLowerCase(),role,plan:role==='free'?'FREE':plan,enabled,expiresAt:expiresAt?new Date(expiresAt+'T23:59:59+07:00').toISOString():null});
      setAdminMessage('Đã cập nhật quyền cho '+(email.trim()||webId.trim().toUpperCase())+'.');
      await loadAccounts();
    }catch(err){setAdminMessage((err as {response?:{data?:{error?:string}}}).response?.data?.error||'Không cập nhật được quyền.');}
  }
  function pickAccount(item:AccessInfo){setWebId(item.webId);setEmail(item.email||'');setRole(item.role);setPlan(item.plan);setEnabled(item.enabled);setExpiresAt(item.expiresAt?item.expiresAt.slice(0,10):'');}
  return <main className="workspace module-page">
    <header className="module-header"><p className="eyebrow">QUẢN TRỊ · ADMIN</p><h1>Quản lý hệ thống</h1><p>Admin gốc có thể quản lý bằng ID web hoặc email đã xác thực: cấp Admin/VIP, đổi gói, khóa/mở và đặt hạn dùng.</p></header>
    <section className="dashboard-panel"><div className="panel-heading"><div><span className="feature-eyebrow">ACCESS CONTROL</span><h2>Cấp quyền theo ID web</h2></div><button className="secondary-button" onClick={loadAccounts}>Làm mới</button></div>
      <div className="form-grid">
        <label>ID web<input value={webId} onChange={e=>setWebId(e.target.value.toUpperCase())} placeholder="HH-XXXXXXXXXX"/></label>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@gmail.com"/></label>
        <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value as 'free'|'vip'|'admin')}><option value="free">Free</option><option value="vip">VIP</option><option value="admin">Admin</option></select></label>
        <label>Gói<select value={plan} disabled={role==='free'} onChange={e=>setPlan(e.target.value)}>{Object.entries(planLabels).filter(([id])=>id!=='FREE').map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
        <label>Hết hạn<input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label>
        <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Đang hoạt động</label>
      </div>
      <button className="primary-button" onClick={saveAccess} disabled={!webId.trim()&&!email.trim()}>LƯU QUYỀN</button>{adminMessage&&<p className="form-note">{adminMessage}</p>}
      <div className="book-list">{accounts.length===0?<div>Chưa có ID khác trong chỉ mục. Người dùng cần đăng nhập web ít nhất một lần.</div>:accounts.map(item=><button className="source-row" key={item.webId} onClick={()=>pickAccount(item)}><span>{item.webId}{item.email?' · '+item.email:''}</span><b>{item.role==='admin'?'ADMIN':item.plan}</b><small>{item.enabled?'Đang mở':'Đã khóa'}{item.expiresAt?' · đến '+item.expiresAt.slice(0,10):' · không hạn'}</small></button>)}</div>
    </section>
    <section className="admin-grid"><article className="dashboard-panel"><div className="panel-heading"><div><span className="feature-eyebrow">KIỂM SOÁT CÔNG THỨC</span><h2>Nguyên tắc vận hành</h2></div></div><div className="status-list"><div><span>Calculation</span><b className="status-work">Chỉ chạy công thức đã kiểm chứng</b></div><div><span>Interpretation</span><b className="status-work">Không tự bổ sung dữ kiện thiếu</b></div><div><span>Xung đột trường phái</span><b className="status-work">Giữ tách biệt, không tự hợp nhất</b></div><div><span>Thiếu căn cứ</span><b className="status-work">Dừng kết luận thay vì suy đoán</b></div></div></article></section>
  </main>;
}

type DeepInterpretation = { overview:string; keyFindings:string[]; strengths:string; cautions:string; domains:{title:string;analysis:string}[]; timing:string; practical:string; limits:string };

const interpretableSections: AppSection[] = ['tuvi','calendar','battrach','iching','bazi','qimen','astrology','sky','numerology','natal'];

function DeepInterpretationPanel({ section, access, onSignIn }:{ section:AppSection; access:AccessInfo|null; onSignIn:()=>void }) {
  const [result,setResult] = useState<DeepInterpretation|null>(null);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState('');
  const planAccess:Record<string,string[]> = {
    NHAN_HOA:['human'],
    NHAT_VAN:['calendar'],
    DIA_LOI:['tuvi'],
    THIEN_THOI:['bazi'],
    SONG_MENH:['tuvi','bazi'],
    TOAN_DIEN:['human','calendar','tuvi','bazi'],
    PREMIUM:['human','calendar','tuvi','bazi','battrach','iching','qimen','astrology','sky','numerology','natal']
  };
  const entitled = !!access && (access.role==='admin' || (planAccess[access.plan] || []).includes(section));

  async function interpret() {
    if(!access){setMessage('Cần đăng nhập để xác định ID web và quyền gói trước khi luận giải.');return;}
    if(!entitled){setMessage('Gói hiện tại chưa có quyền luận giải mục này. Mở Gói dịch vụ để xem quyền tương ứng.');return;}
    const main = document.querySelector('.app-stage main');
    const snapshot = main?.textContent?.replace(/\s+/g,' ').trim() ?? '';
    if (snapshot.length < 80) { setMessage('Hãy lập/tính dữ liệu của mục này trước rồi mới luận giải.'); return; }
    setLoading(true); setMessage(''); setResult(null);
    try { const response = await api.post('/api/interpret',{module:section,snapshot}); setResult(response.data as DeepInterpretation); }
    catch { setMessage('Chưa thể luận giải hoặc ID hiện tại không có quyền cho mục này.'); }
    finally { setLoading(false); }
  }

  return <section className={entitled?'deep-interpret-shell':'deep-interpret-shell access-locked'}>
    <div className="deep-interpret-head"><div><span className="feature-eyebrow">RULE → DATA → INTERPRETATION</span><h2>{entitled?'Luận giải chuyên sâu':'Luận giải đang khóa'}</h2><p>{access?'ID '+access.webId+' · '+(planLabels[access.plan]||access.plan):'Free vẫn được lập/tính dữ liệu. Muốn xem luận giải cần đăng nhập ID web và có gói phù hợp.'}</p></div>{!access?<button className="primary-action" onClick={onSignIn}>ĐĂNG NHẬP ID</button>:<button className="primary-action" onClick={interpret} disabled={loading}>{loading?'ĐANG LUẬN KỸ…':entitled?'LUẬN GIẢI THẬT KỸ':'🔒 XEM QUYỀN GÓI'}</button>}</div>
    {message&&<p className="dream-message">{message}</p>}
    {result&&<div className="deep-interpret-result">
      <article className="deep-overview"><span className="feature-eyebrow">TỔNG LUẬN</span><p>{result.overview}</p></article>
      <div className="deep-findings">{result.keyFindings.map((x,i)=><div key={x}><b>{String(i+1).padStart(2,'0')}</b><p>{x}</p></div>)}</div>
      <div className="deep-pair"><article><span>ĐIỂM THUẬN / NỔI BẬT</span><p>{result.strengths}</p></article><article><span>ĐIỂM CẦN LƯU Ý</span><p>{result.cautions}</p></article></div>
      <div className="deep-domains">{result.domains.map(x=><article key={x.title}><h3>{x.title}</h3><p>{x.analysis}</p></article>)}</div>
      <div className="deep-pair"><article><span>THỜI ĐIỂM / DIỄN BIẾN</span><p>{result.timing}</p></article><article><span>ỨNG DỤNG THỰC TẾ</span><p>{result.practical}</p></article></div>
      <article className="deep-limits"><b>Giới hạn dữ liệu</b><p>{result.limits}</p></article>
    </div>}
  </section>;
}

function App() {
  const hasSharedChart = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('date');
  const [section, setSection] = useState<AppSection>(hasSharedChart ? 'tuvi' : 'dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [access,setAccess] = useState<AccessInfo|null>(null);
  const [authBusy,setAuthBusy] = useState(false);

  useEffect(()=>{ if(auth.isSignedIn()) api.get('/api/me').then(r=>setAccess(r.data as AccessInfo)).catch(()=>setAccess(null)); },[]);
  async function signIn(){setAuthBusy(true);try{await auth.signIn();const r=await api.get('/api/me');setAccess(r.data as AccessInfo);}catch(err){console.warn('sign in cancelled or failed',err);}finally{setAuthBusy(false);}}
  async function signOut(){await auth.signOut();setAccess(null);if(section==='admin'||section==='totalfortune')setSection('dashboard');}
  function navigate(next: AppSection) {
    if(next==='admin' && access?.role!=='admin') return;
    if(next==='totalfortune' && !(access?.role==='admin'||(access?.role==='vip'&&access.active))) return;
    setSection(next);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let content: ReactNode;
  if (section === 'dashboard') content = <Dashboard onNavigate={navigate}/>;
  else if (section === 'totalfortune') content = access && (access.role==='admin'||(access.role==='vip'&&access.active)) ? <TotalFortunePage access={access}/> : <PlansPage access={access} onSignIn={signIn}/>;
  else if (section === 'vantam') content = <VanTamPage/>;
  else if (section === 'tuvi') content = <TuViPage/>;
  else if (section === 'calendar') content = <CalendarPage/>;
  else if (section === 'battrach') content = <BatTrachPage/>;
  else if (section === 'iching') content = <IChingPage/>;
  else if (section === 'bazi') content = <BaziPage/>;
  else if (section === 'qimen') content = <QimenPage/>;
  else if (section === 'astrology') content = <AstrologyPage/>;
  else if (section === 'sky') content = <SkyCompassPage/>;
  else if (section === 'numerology') content = <NumerologyPage/>;
  else if (section === 'natal') content = <NatalChartPage/>;
  else if (section === 'dreams') content = <DreamPage/>;
  else if (section === 'ai') content = <AiPage/>;
  else if (section === 'profiles') content = <ProfilesPage/>;
  else if (section === 'plans') content = <PlansPage access={access} onSignIn={signIn}/>;
  else if (section === 'settings') content = <SettingsPage/>;
  else content = access?.role==='admin' ? <AdminPage/> : <PlansPage access={access} onSignIn={signIn}/>;

  return (
    <div className="app-shell">
      <aside className={navOpen ? 'app-sidebar is-open' : 'app-sidebar'}>
        <button className="brand" onClick={() => navigate('dashboard')}><span className="brand-seal">✦</span><span><strong>Huyền Học</strong><small>Tử Vi · Phong Thủy</small></span></button>
        <nav>{navItems.filter(item=>(item.id!=='admin'||access?.role==='admin')&&(item.id!=='totalfortune'||access?.role==='admin'||(access?.role==='vip'&&access.active))).map(item => <button className={section === item.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.id)} key={item.id}><span>{item.mark}</span>{item.label}</button>)}</nav>

      </aside>
      {navOpen && <button className="nav-backdrop" aria-label="Đóng menu" onClick={() => setNavOpen(false)}/>}
      <div className="app-stage">
        <header className="app-topbar">
          <button className="menu-button" onClick={() => setNavOpen(true)} aria-label="Mở menu">☰</button>
          <div><b>{navItems.find(item => item.id === section)?.label}</b></div>
          <div className="account-zone">{access?<><span className="access-pill">{access.role==='admin'?'ADMIN':access.plan==='FREE'?'FREE':'VIP'} · {access.webId}</span><button className="account-button" onClick={signOut}>Đăng xuất</button></>:<button className="account-button" onClick={signIn} disabled={authBusy}>{authBusy?'Đang mở…':'Đăng nhập'}</button>}</div>
        </header>
        {content}
        {interpretableSections.includes(section) && <DeepInterpretationPanel section={section} access={access} onSignIn={signIn}/>} 
      </div>
      <nav className="mobile-nav">
        {navItems.filter(item => ['dashboard','tuvi','calendar','dreams','profiles'].includes(item.id)).map(item => (
          <button className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)} key={item.id}><span>{item.mark}</span><small>{item.label === 'Phong thủy ngày' ? 'Hôm nay' : item.label}</small></button>
        ))}
      </nav>
    </div>
  );
}

export default App;
