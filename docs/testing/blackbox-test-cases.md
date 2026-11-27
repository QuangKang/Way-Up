# Kiểm thử hộp đen (Black-box) – Way Up!

Kiểm thử dựa trên đặc tả chức năng, không xem mã nguồn. Người kiểm thử chỉ thao tác trên ứng dụng mobile (Expo Go) và quan sát kết quả hiển thị.

**Kỹ thuật sử dụng**

| Ký hiệu | Kỹ thuật | Áp dụng cho |
|---|---|---|
| EP | Phân vùng tương đương (Equivalence Partitioning) | Nickname, mã phòng, màu nhân vật |
| BVA | Phân tích giá trị biên (Boundary Value Analysis) | Độ dài mã phòng, số người chơi, độ dài nickname |
| DT | Bảng quyết định (Decision Table) | Điều kiện bắt đầu trận |
| ST | Chuyển trạng thái (State Transition) | Vòng đời phòng: WAITING → COUNTDOWN → PLAYING → FINISHED |

**Môi trường:** server chạy `npm run dev:server`, 2–5 điện thoại cài Expo Go cùng mạng Wi-Fi, chạy `npm run dev:mobile`.

**Lần chạy 27/11/2026:** dùng script [`blackbox-api.mjs`](blackbox-api.mjs): chạy server thật, giả lập 1–5 điện thoại bằng `socket.io-client`, chỉ gửi/nhận các event công khai giống app.

- `Pass`: hành vi đã kiểm đầy đủ.
- `Pass (API)`: phía server đúng; phần giao diện (nút bị khoá, giới hạn ô nhập, màn hình hiển thị) chưa kiểm trên điện thoại.
- `Chưa test`: cần thao tác trên điện thoại thật.

Chạy lại: `npm run build:shared`, `npm run dev:server`, rồi ở terminal khác `node docs/testing/blackbox-api.mjs` (~2 phút).

---

## 1. Hồ sơ người chơi (nickname)

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-01 | EP (hợp lệ) | Sửa nickname → Lưu | `Minh` | Lưu thành công, nickname mới hiển thị ở màn hình chính | Server lưu nickname "P1" | Pass |
| TC-02 | EP (không hợp lệ) | Xoá hết nickname → Lưu | `""` | Báo lỗi "nickname không được để trống", không lưu | Bị từ chối: "Player ID and a non-empty nickname are required" | Pass (API) |
| TC-03 | EP (không hợp lệ) | Nhập toàn khoảng trắng → Lưu | `"     "` | Báo lỗi như TC-02 | Bị từ chối, cùng thông báo như TC-02 | Pass (API) |
| TC-04 | BVA (biên trên) | Nhập 20 ký tự → Lưu | `abcdefghijklmnopqrst` | Lưu đủ 20 ký tự | Lưu đủ 20 ký tự | Pass |
| TC-05 | BVA (trên biên) | Cố nhập ký tự thứ 21 | `abcdefghijklmnopqrstu` | Ô nhập không nhận ký tự thứ 21 | UI chưa kiểm. Server: gửi thẳng 30 ký tự → cắt còn 24 | Pass (API) |
| TC-06 | EP | Nhập có khoảng trắng đầu/cuối → Lưu | `"  Minh  "` | Lưu thành `Minh` (đã cắt khoảng trắng) | Lưu thành "Minh" | Pass |
| TC-07 | — | Lưu nickname, tắt hẳn app, mở lại | `Minh` | Nickname vẫn là `Minh` (lưu SQLite) | Cần điện thoại (SQLite) | Chưa test |

## 2. Tạo phòng / vào phòng

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-08 | EP (hợp lệ) | Bấm "Tạo phòng" | — | Vào phòng chờ, hiện mã 4 ký tự, mình là Host | Nhận mã 4 ký tự (vd. SBTR), là Host | Pass |
| TC-09 | EP | Quan sát mã phòng ở TC-08 qua nhiều lần tạo | — | Mã chỉ gồm chữ in hoa/số, không có `0`, `O`, `1`, `I` | 100 mã, không trùng, không có 0/O/1/I | Pass |
| TC-10 | BVA (dưới biên) | Nhập mã 3 ký tự | `AB2` | Nút "Vào phòng" bị vô hiệu hoá | UI chưa kiểm. Server: mã 3 ký tự → INVALID_ROOM_CODE | Pass (API) |
| TC-11 | BVA (đúng biên) | Máy B nhập mã phòng của máy A | mã 4 ký tự đúng | Máy B vào cùng phòng, máy A thấy B xuất hiện | B vào phòng, A nhận cập nhật thấy 2 người | Pass |
| TC-12 | BVA (trên biên) | Cố nhập ký tự thứ 5 | `AB2C3` | Ô nhập chỉ nhận 4 ký tự | UI chưa kiểm. Server: mã 5 ký tự → INVALID_ROOM_CODE | Pass (API) |
| TC-13 | EP | Nhập mã chữ thường của phòng có thật | `ab2c` | Vào phòng bình thường (không phân biệt hoa/thường) | Nhập mã chữ thường vẫn vào được | Pass |
| TC-14 | EP (không hợp lệ) | Nhập mã 4 ký tự không tồn tại | `0000` | Báo "Room code not found…" | "Room code not found. Double-check the 4-character code." | Pass |
| TC-15 | ST | Máy C nhập mã phòng đang chơi | mã phòng PLAYING | Báo "Match is already in progress…" | "Match is already in progress for this room." | Pass |
| TC-16 | — | Tắt server → mở app | — | Nút Tạo phòng / Vào phòng bị vô hiệu hoá; chế độ Offline vẫn chơi được | UI chưa kiểm. Client nhận connect_error khi server tắt | Pass (API) |

## 3. Số người chơi trong phòng

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-17 | BVA (1 người) | Host ở một mình | 1 người | Nút "Bắt đầu" bị vô hiệu hoá | UI chưa kiểm. Server: start 1 người → NOT_ENOUGH_PLAYERS | Pass (API) |
| TC-18 | BVA (2 người) | Thêm 1 người, người đó bấm Sẵn sàng | 2 người | Nút "Bắt đầu" bật được | Bắt đầu được | Pass |
| TC-19 | BVA (4 người) | Thêm tới 4 người | 4 người | Cả 4 vào được, hiển thị 4/4 | 4/4 người trong phòng | Pass |
| TC-20 | BVA (5 người) | Máy thứ 5 nhập mã | 5 người | Máy 5 báo "This room is already full (4/4 climbers)" | "This room is already full (4/4 climbers)." | Pass |
| TC-21 | ST | Host thoát khỏi phòng có 3 người | — | Một người còn lại tự động thành Host | P2 tự động thành Host | Pass |
| TC-22 | ST | Người cuối cùng thoát | — | Phòng bị xoá; nhập lại mã đó báo "not found" | Phòng bị xoá, vào lại → ROOM_NOT_FOUND | Pass |

## 4. Màu nhân vật & cài đặt trận

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-23 | EP | 4 người vào phòng | — | Mỗi người một màu khác nhau | 4 màu khác nhau | Pass |
| TC-24 | EP (không hợp lệ) | Máy B chọn màu máy A đang dùng | màu đã bị chiếm | Ô màu đó bị khoá, không chọn được | UI chưa kiểm. Server: chọn màu đã có người → COLOR_ALREADY_TAKEN | Pass (API) |
| TC-25 | EP | Máy B chọn màu còn trống | màu trống | Đổi màu thành công, mọi máy cập nhật | Đổi màu thành công, máy kia nhận cập nhật | Pass |
| TC-26 | EP | Khách (không phải Host) thử đổi cài đặt | — | Các nút cài đặt bị vô hiệu hoá | UI chưa kiểm. Server: khách đổi cài đặt → UNAUTHORIZED_NOT_HOST | Pass (API) |
| TC-27 | BVA | Host chọn lần lượt thời gian 60s và 300s | 60, 300 | Mọi máy thấy giá trị mới; trận kết thúc đúng thời gian đã chọn | 60s: trận kết thúc sau 60.0s. 300s: lưu được timeLimitSec=300 | Pass |
| TC-28 | EP | Host tắt "Băng" và "Đá rơi" → bắt đầu | Ice OFF, Boulders OFF | Trong trận không có bậc băng và đá rơi | Mọi máy nhận ice=off, boulders=off; bản đồ sinh ra không có bậc băng/đá (chưa xem trên màn hình) | Pass (API) |

## 5. Bắt đầu trận – bảng quyết định

| Điều kiện / Luật | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| Người bấm là Host | N | Y | Y | Y |
| Số người ≥ 2 | – | N | Y | Y |
| Tất cả đã Sẵn sàng | – | – | N | Y |
| **Kết quả: bắt đầu đếm ngược** | Không (nút ẩn/khoá) | Không | Không | **Có** |

| ID | Luật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-29 | R1 | Khách nhìn màn hình phòng chờ | Không có nút Bắt đầu khả dụng | UI chưa kiểm. Server: khách gửi start → UNAUTHORIZED_NOT_HOST | Pass (API) |
| TC-30 | R2 | Host ở một mình | Nút Bắt đầu bị khoá | UI chưa kiểm. Server → NOT_ENOUGH_PLAYERS | Pass (API) |
| TC-31 | R3 | 2 người, khách chưa Sẵn sàng | Nút Bắt đầu bị khoá | UI chưa kiểm. Server → NOT_ALL_PLAYERS_READY | Pass (API) |
| TC-32 | R4 | 2 người, tất cả Sẵn sàng → Host bấm Bắt đầu | Mọi máy đếm 3-2-1 rồi vào trận cùng lúc | Đếm 3-2-1, các máy nhận cùng thời điểm bắt đầu | Pass |

## 6. Trong trận

| ID | Kỹ thuật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-33 | ST | Trong lúc đếm ngược, 1 khách thoát | Huỷ đếm ngược, phòng quay về trạng thái chờ | Huỷ đếm ngược, phòng về WAITING, không vào trận | Pass |
| TC-34 | — | So sánh màn chơi giữa các máy trong cùng trận | Vị trí bậc, băng, đá rơi giống hệt nhau trên mọi máy | 4 máy nhận cùng seed, bản đồ sinh ra giống hệt | Pass |
| TC-35 | EP | Bấm đúng hướng mũi tên | Nhân vật leo lên 1 bậc (+10m) | Cần điện thoại (thao tác chạm) | Chưa test |
| TC-36 | EP (sai) | Bấm sai hướng | Hiện thông báo trượt, rơi xuống 2 bậc | Cần điện thoại (thao tác chạm) | Chưa test |
| TC-37 | — | Đứng yên trên bậc băng quá ~0.75s | Nhân vật trượt xuống 2 bậc | Cần điện thoại (thao tác chạm) | Chưa test |
| TC-38 | — | Bị đá rơi trúng | Nhân vật bị choáng, rơi xuống 3 bậc | Cần điện thoại (thao tác chạm) | Chưa test |
| TC-39 | — | Quan sát máy khác khi mình leo | Vị trí của mình cập nhật gần thời gian thực trên máy khác | Máy kia thấy vị trí mới sau ~11ms (mạng LAN cục bộ) | Pass |
| TC-46 | EP (không hợp lệ) | Gửi gói tin báo nhảy thẳng lên 200m (giả lập gian lận) | Server từ chối, vị trí giữ nguyên | Server bỏ qua gói tin, vị trí vẫn 0m | Pass |
| TC-40 | ST | Một người lên tới đích, người khác chưa | Người đó hiện "đã về đích", những người khác vẫn chơi tiếp | A về đích, trận vẫn PLAYING, người khác chơi tiếp | Pass |
| TC-41 | ST | Tất cả lên tới đích | Trận kết thúc, chuyển sang màn hình kết quả | Trận kết thúc, reason = ALL_FINISHED | Pass |
| TC-42 | ST | Không ai về đích, chờ hết giờ | Trận kết thúc khi hết thời gian | Hết 60s, reason = TIME_LIMIT | Pass |

## 7. Kết quả & chơi lại

| ID | Kỹ thuật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-43 | — | Xem bảng xếp hạng | Người về đích xếp theo thời gian tăng dần, người chưa về xếp theo độ cao giảm dần | P1 (4.96s) > P2 (10.01s); người đã thoát không có trong bảng | Pass |
| TC-44 | ST | Host bấm Chơi lại | Tất cả về phòng chờ, độ cao về 0, khách phải bấm Sẵn sàng lại | Phòng về WAITING, độ cao = 0, khách phải Sẵn sàng lại | Pass |
| TC-45 | ST | Khách (không phải Host) bấm Chơi lại | Cả phòng quay về phòng chờ, host giữ nguyên (mọi thành viên đều được bấm Chơi lại) | Khách bấm được, cả phòng về WAITING, host giữ nguyên; người ngoài phòng bị từ chối | Pass |

---

## Tổng kết

| Nhóm | Số TC | Pass | Pass (API) | Fail | Chưa test |
|---|---|---|---|---|---|
| 1. Nickname | 7 | 3 | 3 | 0 | 1 |
| 2. Tạo / vào phòng | 9 | 6 | 3 | 0 | 0 |
| 3. Số người chơi | 6 | 5 | 1 | 0 | 0 |
| 4. Màu & cài đặt | 6 | 3 | 3 | 0 | 0 |
| 5. Bắt đầu trận | 4 | 1 | 3 | 0 | 0 |
| 6. Trong trận | 11 | 7 | 0 | 0 | 4 |
| 7. Kết quả & chơi lại | 3 | 3 | 0 | 0 | 0 |
| **Tổng** | **46** | **28** | **13** | **0** | **5** |

> Kiểm thử hộp trắng (unit test) cho PRNG, bộ sinh màn chơi và logic phòng nằm ở `packages/shared/test` và `apps/server/test`, chạy bằng `npm test`.
