import { ai, db, error, json, requireAuth, router } from '@appdeploy/sdk';

type PlanId = 'FREE'|'NHAN_HOA'|'NHAT_VAN'|'DIA_LOI'|'THIEN_THOI'|'SONG_MENH'|'TOAN_DIEN'|'PREMIUM';
type AccessRecord = { userId:string; webId:string; role:'free'|'vip'|'admin'; plan:PlanId; enabled:boolean; startsAt:string; expiresAt:string|null; createdAt:string; updatedAt:string };
type AccessIndexRecord = AccessRecord & { accessTable:string; accessRecordId:string; email?:string; name?:string };

const interpretationSchema = { type:'object', properties:{ overview:{type:'string'}, keyFindings:{type:'array',items:{type:'string'}}, strengths:{type:'string'}, cautions:{type:'string'}, domains:{type:'array',items:{type:'object',properties:{title:{type:'string'},analysis:{type:'string'}},required:['title','analysis']}}, timing:{type:'string'}, practical:{type:'string'}, limits:{type:'string'} }, required:['overview','keyFindings','strengths','cautions','domains','timing','practical','limits'] };
const dreamSchema = { type:'object', properties:{ summary:{type:'string'}, elements:{type:'array',items:{type:'string'}}, emotions:{type:'array',items:{type:'string'}}, narrative:{type:'string'}, emotionalDynamics:{type:'string'}, symbolContext:{type:'string'}, modern:{type:'string'}, neuroscience:{type:'string'}, jung:{type:'string'}, freud:{type:'string'}, synthesis:{type:'string'}, confidence:{type:'string'}, questions:{type:'array',items:{type:'string'}}, caution:{type:'string'} }, required:['summary','elements','emotions','narrative','emotionalDynamics','symbolContext','modern','neuroscience','jung','freud','synthesis','confidence','questions','caution'] };
const totalFortuneSchema = { type:'object', properties:{ daySummary:{type:'string'}, monthSummary:{type:'string'}, convergence:{type:'array',items:{type:'string'}}, conflicts:{type:'array',items:{type:'string'}}, domains:{type:'array',items:{type:'object',properties:{title:{type:'string'},day:{type:'string'},month:{type:'string'},sources:{type:'array',items:{type:'string'}}},required:['title','day','month','sources']}}, dayFlow:{type:'array',items:{type:'object',properties:{period:{type:'string'},analysis:{type:'string'},sources:{type:'array',items:{type:'string'}}},required:['period','analysis','sources']}}, monthMarkers:{type:'array',items:{type:'object',properties:{period:{type:'string'},analysis:{type:'string'},sources:{type:'array',items:{type:'string'}}},required:['period','analysis','sources']}}, practical:{type:'array',items:{type:'string'}}, limits:{type:'array',items:{type:'string'}} }, required:['daySummary','monthSummary','convergence','conflicts','domains','dayFlow','monthMarkers','practical','limits'] };

const moduleGuidance: Record<string,string> = {
  tuvi:'Tử Vi: luận Mệnh/Thân, tam phương tứ chính, chính-phụ tinh, Tuần/Triệt, Tứ Hóa, công việc, tài lộc, tình cảm-gia đạo, sức khỏe theo nghĩa xu hướng, nhà cửa, con cái và vận khi dữ liệu HIỂN THỊ có hỗ trợ. Phân biệt bản mệnh với đại/tiểu/lưu vận. Không tự thêm sao.',
  calendar:'Phong thủy ngày: giải nghĩa Can Chi, trực/thần, Yi-Ji, xung sát và phương vị đã tính. Nêu việc hợp/không hợp theo chính dữ liệu màn hình; không tự tạo giờ tốt, màu hay tuổi hợp nếu chưa có.',
  battrach:'Bát Trạch: chỉ luận khi màn hình đã có quái mệnh/hướng/rule kết quả. Nếu engine đang khóa hoặc chỉ có input/nguồn sách thì phải nói chưa đủ dữ liệu, tuyệt đối không tự tính quái số/hướng cát hung.',
  iching:'Kinh Dịch/Lục Hào: bám Quẻ chủ-Hỗ-Biến, hào động, Thế-Ứng, Nhật thần, Nguyệt lệnh, Lục Thân, Nạp Giáp, Tuần Không, vượng suy và thần sát đang hiển thị. Không tự chọn Dụng thần/Nguyên-Kỵ thần nếu engine chưa khóa. Luận diễn biến, thuận-nghịch, điểm chuyển và thời điểm chỉ khi dữ liệu hỗ trợ.',
  bazi:'Bát Tự: bám 4 trụ, Nhật chủ, Nguyệt lệnh, tàng can, Thập thần, Trường sinh, Nạp âm và tương tác đã tính. Không tự phán Cường/Nhược, Cách cục, Dụng/Hỷ/Kỵ nếu màn hình ghi các lớp đó chưa khóa. Có thể giải thích ý nghĩa cấu trúc và nêu điều cần kiểm tra tiếp.',
  qimen:'Kỳ Môn: bám Âm/Dương Độn, cục, địa bàn, Cửu tinh/Bát môn, Tuần thủ, Trực Phù/Trực Sử và các rule đã hiện. Nếu Thiên/Nhân/Thần bàn động chưa dựng thì không được luận như đã có đủ bàn.',
  astrology:'Chiêm tinh hiện tại: bám vị trí hành tinh/cung/độ đã tính; mô tả chủ đề biểu tượng, không tự tạo góc chiếu, houses, ASC/MC nếu không hiển thị.',
  sky:'Huyền Thiên Tinh Bàn: giải thích vùng trời, hướng nhìn, thiên thể, azimuth/altitude và decan zodiacal đang hiển thị. Không đánh đồng decan zodiacal 10° với stellar decans Ai Cập cổ.',
  numerology:'Thần số học Pythagoras: bám đúng các số đã tính như đường đời, ngày sinh, thái độ, biểu đạt, linh hồn, nhân cách; nêu điểm giao nhau/mâu thuẫn giữa chúng. Không tự thêm hệ Chaldean hay chỉ số chưa tính.',
  natal:'Bản đồ sao: bám vị trí hành tinh/cung/độ đang có. Nếu app chưa có ASC/MC/houses/aspects thì nêu rõ và không tự suy ra.'
};
const planModules: Record<PlanId,string[]> = {
  FREE: [],
  NHAN_HOA: ['human'],
  NHAT_VAN: ['calendar'],
  DIA_LOI: ['tuvi'],
  THIEN_THOI: ['bazi'],
  SONG_MENH: ['tuvi','bazi'],
  TOAN_DIEN: ['human','calendar','tuvi','bazi'],
  PREMIUM: ['human','calendar','tuvi','bazi','battrach','iching','qimen','astrology','sky','numerology','natal']
};

const planRules: Record<PlanId,string> = {
  FREE: 'Chỉ dùng engine tính/lập dữ liệu. Không được sinh nội dung luận giải AI.',
  NHAN_HOA: 'Chỉ luận tình huống và con người từ dữ liệu Nhân Hòa được cung cấp. Tập trung động cơ, tương tác, trạng thái và lựa chọn; không lấn sang Tử Vi/Bát Tự/Nhật Vận nếu gói không có.',
  NHAT_VAN: 'Chỉ luận thời điểm hành động từ dữ liệu ngày đã tính: Can Chi, trực/thần, Yi-Ji, xung sát, phương vị và các trường ngày đang hiển thị. Màu, giờ hoặc vận trình chỉ được nói khi engine có dữ liệu tương ứng.',
  DIA_LOI: 'Chỉ dùng lớp Tử Vi: Mệnh/Thân, 12 cung, tam phương tứ chính, sao, Tuần/Triệt, Tứ Hóa và vận đã hiển thị. Phân tích đường đời và hoàn cảnh; tuyệt đối không tự mượn Bát Tự để bổ sung.',
  THIEN_THOI: 'Chỉ dùng lớp Bát Tự: Tứ Trụ, Nhật chủ, Nguyệt lệnh, tàng can, Thập thần, Trường sinh, Nạp âm và tương tác đã tính. Không tự phán Cường/Nhược, Cách cục, Dụng/Hỷ/Kỵ khi engine chưa khóa.',
  SONG_MENH: 'Có Địa Lợi + Thiên Thời. Khi có dữ liệu của cả hai hệ mới được đối chiếu điểm đồng thuận, khác biệt và lớp nào đang nói về bản chất hay thời vận; không ép hai hệ thành một phép tính và không để hệ này sửa dữ kiện của hệ kia.',
  TOAN_DIEN: 'Có Nhân Hòa + Nhật Vận + Địa Lợi + Thiên Thời. Mỗi hệ phải được trình bày thành lớp riêng trước, sau đó mới tổng hợp giao điểm. Không trộn rule, không dùng một hệ để tự tạo dữ kiện còn thiếu của hệ khác.',
  PREMIUM: 'Có toàn bộ quyền luận giải hiện có và lớp cao cấp. Cho phép tổng hợp đa hệ, tương hợp, chọn ngày giờ và báo cáo nâng cao CHỈ trên dữ liệu engine đã tính từ công thức đã kiểm chứng theo sách và bộ test. Dữ liệu thiếu hoặc công thức chưa kiểm chứng thì nêu thiếu và dừng kết luận; tuyệt đối không bịa để hoàn thiện báo cáo.'
};

function active(record:AccessRecord) {
  return record.enabled && (!record.expiresAt || new Date(record.expiresAt).getTime() > Date.now()) && new Date(record.startsAt).getTime() <= Date.now();
}
function canInterpret(record:AccessRecord,module:string) {
  if(record.role==='admin') return true;
  if(!active(record)) return false;
  return (planModules[record.plan] || []).includes(module);
}
function ruleFor(record:AccessRecord) {
  if(record.role==='admin') return 'ADMIN: có toàn bộ entitlement và toàn bộ rule pack của mọi gói. Vẫn phải tuân thủ rule tính toán, giới hạn dữ liệu và không được tự bịa dữ kiện.';
  return planRules[record.plan];
}
const ROOT_ADMIN_WEB_IDS = new Set(['HH-2C482676DD']);
const ADMIN_EMAILS = new Set(['kinrennie@gmail.com']);

async function syncAccessIndex(record:AccessRecord & { id?:string }, table:string, identity?:{email?:string;name?:string}) {
  if(!record.id) return;
  const { items } = await db.list<AccessIndexRecord>('access-index',{limit:200});
  const found = items.find(item => item.userId === record.userId);
  const indexed: AccessIndexRecord = { ...record, accessTable:table, accessRecordId:record.id, email:identity?.email ?? found?.email, name:identity?.name ?? found?.name };
  delete (indexed as {id?:string}).id;
  if(found) await db.update('access-index',[{id:found.id,record:indexed}]);
  else await db.add('access-index',[indexed]);
}

async function requireAdminAccess(userId:string) {
  const access = await getAccess(userId);
  if(access.role !== 'admin' || !active(access)) return null;
  return access;
}

async function getAccess(userId:string, identity?:{email?:string;name?:string}) {
  const table = `access:${userId}`;
  const { items } = await db.list<AccessRecord>(table,{limit:1});
  const derivedWebId = `HH-${userId.replace(/-/g,'').slice(0,10).toUpperCase()}`;
  const normalizedEmail = identity?.email?.trim().toLowerCase();
  const isRootAdmin = ROOT_ADMIN_WEB_IDS.has(derivedWebId);
  const isEmailAdmin = !!normalizedEmail && ADMIN_EMAILS.has(normalizedEmail);
  const shouldBeAdmin = isRootAdmin || isEmailAdmin;

  if(items[0]) {
    const current = items[0];
    if(shouldBeAdmin && (current.role !== 'admin' || current.plan !== 'PREMIUM' || !current.enabled)) {
      const updated: AccessRecord = {
        ...current,
        webId: derivedWebId,
        role: 'admin',
        plan: 'PREMIUM',
        enabled: true,
        expiresAt: null,
        updatedAt: new Date().toISOString()
      };
      const [ok] = await db.update(table,[{id:current.id,record:updated}]);
      if(!ok) throw new Error('Không thể kích hoạt Admin gốc.');
      const result = {...updated,id:current.id};
      await syncAccessIndex(result,table,identity);
      return result;
    }
    await syncAccessIndex(current,table,identity);
    return current;
  }

  const now = new Date().toISOString();
  const record:AccessRecord = {
    userId,
    webId: derivedWebId,
    role: shouldBeAdmin ? 'admin' : 'free',
    plan: shouldBeAdmin ? 'PREMIUM' : 'FREE',
    enabled: true,
    startsAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now
  };
  const [id] = await db.add(table,[record]);
  if(!id) throw new Error('Không thể tạo hồ sơ quyền.');
  const result = {...record,id};
  await syncAccessIndex(result,table,identity);
  return result;
}
export const handler = router({
  'GET /api/_healthcheck':[async()=>json({message:'Success'})],
  'GET /api/me':[requireAuth(),async(ctx)=>{const access=await getAccess(ctx.user!.userId,{email:ctx.user!.email,name:ctx.user!.name});return json({webId:access.webId,role:access.role,plan:access.plan,enabled:access.enabled,startsAt:access.startsAt,expiresAt:access.expiresAt,active:active(access),email:ctx.user!.email,name:ctx.user!.name});}],
  'GET /api/admin/access':[requireAuth(),async(ctx)=>{
    const admin=await requireAdminAccess(ctx.user!.userId); if(!admin) return error('Chỉ Admin mới có quyền quản lý tài khoản.',403);
    const {items}=await db.list<AccessIndexRecord>('access-index',{limit:200});
    return json({items:items.map(({id,...item})=>item)});
  }],
  'PUT /api/admin/access':[requireAuth(),async(ctx)=>{
    const admin=await requireAdminAccess(ctx.user!.userId); if(!admin) return error('Chỉ Admin mới có quyền quản lý tài khoản.',403);
    const input=ctx.body as {webId?:string;email?:string;role?:'free'|'vip'|'admin';plan?:PlanId;enabled?:boolean;startsAt?:string;expiresAt?:string|null};
    const webId=(input.webId||'').trim().toUpperCase();
    const email=(input.email||'').trim().toLowerCase();
    if(!webId && !email) return error('Nhập ID web hoặc email.',400);
    if(webId && !/^HH-[A-F0-9]{10}$/.test(webId)) return error('ID web không hợp lệ.',400);
    const {items}=await db.list<AccessIndexRecord>('access-index',{limit:200});
    const target=items.find(item=>(webId && item.webId===webId)||(email && item.email?.toLowerCase()===email));
    if(!target) return error('Email/ID này chưa từng đăng nhập web nên chưa có hồ sơ để cấp quyền. Hãy đăng nhập một lần trước.',404);
    if(ROOT_ADMIN_WEB_IDS.has(target.webId) && (input.role && input.role!=='admin' || input.enabled===false)) return error('Không thể hạ quyền hoặc khóa Root Admin.',400);
    const nextRole=input.role ?? target.role; const nextPlan=input.plan ?? target.plan;
    const updated:AccessRecord={userId:target.userId,webId:target.webId,role:nextRole,plan:nextPlan,enabled:input.enabled ?? target.enabled,startsAt:input.startsAt || target.startsAt,expiresAt:input.expiresAt===undefined?target.expiresAt:input.expiresAt,createdAt:target.createdAt,updatedAt:new Date().toISOString()};
    const [ok]=await db.update(target.accessTable,[{id:target.accessRecordId,record:updated}]); if(!ok) return error('Không thể cập nhật quyền.',500);
    await syncAccessIndex({...updated,id:target.accessRecordId},target.accessTable);
    return json({ok:true,record:updated});
  }],
  'POST /api/interpret':[requireAuth(),async(ctx)=>{
    const input=ctx.body as {module?:string;snapshot?:string}; const module=input.module?.trim()??''; const snapshot=input.snapshot?.trim()??'';
    if(!moduleGuidance[module]) return error('Module chưa hỗ trợ luận giải.',400); const access=await getAccess(ctx.user!.userId); if(!canInterpret(access,module)) return error('Gói hiện tại chưa có quyền luận giải mục này.',403); if(snapshot.length<80) return error('Chưa có đủ kết quả để luận. Hãy tính/lập dữ liệu trước.',400);
    const system=`Bạn là engine LUẬN GIẢI chuyên sâu cho ứng dụng huyền học. Nguyên tắc tuyệt đối: dữ liệu tính toán/rule có sẵn trước, AI chỉ diễn giải sau. Chỉ được dùng dữ liệu xuất hiện trong SNAPSHOT; không tự tính lại, không tự thêm sao, quẻ, cung, góc chiếu, dụng thần, hướng hay mốc thời gian không có. Nếu snapshot nói một rule/lớp đang khóa/chưa triển khai, phải giữ nguyên giới hạn đó. Phân biệt rõ dữ kiện -> diễn giải -> giới hạn. Luận kỹ, cụ thể, tránh văn mẫu. overview khoảng 150-250 từ; strengths/cautions mỗi phần 120-220 từ; mỗi domain 120-220 từ khi có đủ dữ kiện. keyFindings 4-8 ý ngắn nhưng cụ thể. timing chỉ nêu mốc có căn cứ trực tiếp từ snapshot; nếu không có thì nói chưa đủ dữ kiện. practical là cách ứng dụng/điểm nên quan sát, không hứa hẹn chắc chắn. Với sức khỏe/tai nạn/cái chết/pháp lý/tài chính, chỉ mô tả xu hướng biểu tượng hoặc cảnh báo tham khảo, không chẩn đoán hay khẳng định sự kiện. Không dùng nạp âm thay Nhật chủ trong Bát Tự. Không trộn trường phái. Trả JSON đúng schema.`;
    try{const result=await ai.generate({system,prompt:`MODULE: ${module}\nGÓI/ROLE: ${access.role === 'admin' ? 'ADMIN' : access.plan}\nRULE PACK THEO GÓI: ${ruleFor(access)}\nQUY TẮC RIÊNG CỦA MODULE: ${moduleGuidance[module]}\n\nSNAPSHOT KẾT QUẢ HIỂN THỊ:\n${snapshot.slice(0,18000)}\n\nHãy luận toàn diện nhưng chỉ trong phạm vi dữ liệu và rule pack được cấp. Nếu có phần người dùng kỳ vọng mà dữ liệu hoặc gói chưa đủ, ghi rõ trong limits.`,schema:interpretationSchema,thinkingMode:'DEEP',temperature:.18,maxTokens:6000});return json(JSON.parse(result.text));}catch(err){console.error('interpretation failed',err);return error('Không thể luận giải lúc này.',500);}
  }],
  'POST /api/total-fortune':[requireAuth(),async(ctx)=>{
    const access=await getAccess(ctx.user!.userId,{email:ctx.user!.email,name:ctx.user!.name});
    if(access.role!=='admin' && (access.role!=='vip' || !active(access))) return error('Tổng Vận là đặc quyền VIP.',403);
    const input=ctx.body as {profile?:{name?:string;gender?:string;birthDate?:string;birthTime?:string;birthPlace?:string};targetDate?:string;latitude?:number;longitude?:number;timezone?:string;engineData?:Record<string,string>};
    if(!input.profile?.birthDate || !input.profile?.birthTime || !input.targetDate) return error('Thiếu ngày giờ sinh hoặc ngày cần xem.',400);
    const lat=Number(input.latitude), lon=Number(input.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180) return error('Tọa độ hiện tại không hợp lệ.',400);
    const layers=Object.entries(input.engineData||{}).filter(([,v])=>typeof v==='string'&&v.trim().length>20).map(([k,v])=>`[${k}]\n${v.slice(0,5000)}`).join('\n\n');
    if(layers.length<80) return error('Chưa có đủ dữ liệu engine để tổng hợp.',400);
    const system=`Bạn là lớp TỔNG HỢP đa hệ, không phải engine tính toán. Chỉ diễn giải dữ liệu đã được các engine cung cấp từ những công thức đã kiểm chứng theo sách và bộ test. Tuyệt đối không tự tính hay bịa sao, cung, Tứ Trụ, Dụng thần, Tứ Hóa, góc chiếu, Kỳ Môn, giờ tốt, phương vị hoặc mốc thời gian. Giữ từng hệ độc lập trước khi tìm giao điểm. Tọa độ hiện tại chỉ được dùng cho lớp thật sự phụ thuộc vị trí; không dùng nó để thay đổi lá số sinh Tử Vi/Bát Tự. Nếu hệ nào thiếu, đang khóa, hoặc chưa đủ căn cứ đã kiểm chứng, đưa vào limits và không suy đoán để lấp chỗ trống. Không hiển thị thư mục, tên sách, liên kết hoặc danh sách nguồn trong nội dung trả cho người dùng. Không khẳng định chắc chắn tai nạn, bệnh, cái chết, ngoại tình, thắng thua tài chính hoặc sự kiện tương lai. Trả JSON đúng schema.`;
    try{
      const result=await ai.generate({system,prompt:`HỒ SƠ: ${JSON.stringify(input.profile)}\nNGÀY XEM: ${input.targetDate}\nTỌA ĐỘ HIỆN TẠI: ${lat}, ${lon}\nMÚI GIỜ: ${input.timezone||'Asia/Ho_Chi_Minh'}\nGÓI: ${access.role==='admin'?'ADMIN':access.plan}\n\nDỮ LIỆU ENGINE ĐÃ TÍNH:\n${layers}\n\nHãy tổng hợp vận ngày và vận tháng: tổng quan, sáng/trưa/chiều/tối chỉ khi dữ liệu hỗ trợ, công việc, tài chính, tình cảm-giao tiếp, năng lượng/sức khỏe theo nghĩa xu hướng, đi lại, cơ hội/rủi ro, việc nên ưu tiên/tránh và các mốc trong tháng có căn cứ. Phân biệt đồng thuận và mâu thuẫn giữa các hệ.`,schema:totalFortuneSchema,thinkingMode:'DEEP',temperature:.15,maxTokens:7000});
      return json(JSON.parse(result.text));
    }catch(err){console.error('total fortune failed',err);return error('Không thể tổng hợp Tổng Vận lúc này.',500);}
  }],
  'POST /api/dreams/analyze':[requireAuth(),async(ctx)=>{
    const access=await getAccess(ctx.user!.userId); if(!canInterpret(access,'human')) return error('Gói hiện tại chưa có quyền phân tích nội dung này.',403);
    const input=ctx.body as {dream?:string;context?:string}; const dream=input.dream?.trim()??''; if(dream.length<20) return error('Giấc mơ quá ngắn để phân tích.',400);
    const system=`Bạn là bộ phân tích giấc mơ chuyên sâu, có kỷ luật nguồn. RULE PACK ĐƯỢC CẤP: ${ruleFor(access)} Viết tiếng Việt tự nhiên, cụ thể, có chiều sâu, không chẩn đoán. Tách tâm lý học hiện đại, neuroscience, Jung và Freud; không dự báo tương lai, tai nạn, bệnh, cái chết, ngoại tình hoặc sự kiện chắc chắn. Không suy diễn trauma hay bệnh tâm thần. Trả JSON đúng schema.`;
    try{const result=await ai.generate({system,prompt:`GIẤC MƠ:\n${dream}\n\nBỐI CẢNH TỰ KHAI:\n${input.context?.trim()||'Không cung cấp'}\n\nPhân tích theo đúng schema, bám chi tiết lời kể và nêu giới hạn.`,schema:dreamSchema,thinkingMode:'DEEP',temperature:.2,maxTokens:5200});return json(JSON.parse(result.text));}catch(err){console.error('dream analysis failed',err);return error('Không thể phân tích giấc mơ lúc này.',500);}
  }]
});