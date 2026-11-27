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

**Cách điền:** cột *Thực tế* ghi kết quả quan sát được, *KQ* ghi `Pass` / `Fail`.

---

## 1. Hồ sơ người chơi (nickname)

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-01 | EP (hợp lệ) | Sửa nickname → Lưu | `Minh` | Lưu thành công, nickname mới hiển thị ở màn hình chính | | |
| TC-02 | EP (không hợp lệ) | Xoá hết nickname → Lưu | `""` | Báo lỗi "nickname không được để trống", không lưu | | |
| TC-03 | EP (không hợp lệ) | Nhập toàn khoảng trắng → Lưu | `"     "` | Báo lỗi như TC-02 | | |
| TC-04 | BVA (biên trên) | Nhập 20 ký tự → Lưu | `abcdefghijklmnopqrst` | Lưu đủ 20 ký tự | | |
| TC-05 | BVA (trên biên) | Cố nhập ký tự thứ 21 | `abcdefghijklmnopqrstu` | Ô nhập không nhận ký tự thứ 21 | | |
| TC-06 | EP | Nhập có khoảng trắng đầu/cuối → Lưu | `"  Minh  "` | Lưu thành `Minh` (đã cắt khoảng trắng) | | |
| TC-07 | — | Lưu nickname, tắt hẳn app, mở lại | `Minh` | Nickname vẫn là `Minh` (lưu SQLite) | | |

## 2. Tạo phòng / vào phòng

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-08 | EP (hợp lệ) | Bấm "Tạo phòng" | — | Vào phòng chờ, hiện mã 4 ký tự, mình là Host | | |
| TC-09 | EP | Quan sát mã phòng ở TC-08 qua nhiều lần tạo | — | Mã chỉ gồm chữ in hoa/số, không có `0`, `O`, `1`, `I` | | |
| TC-10 | BVA (dưới biên) | Nhập mã 3 ký tự | `AB2` | Nút "Vào phòng" bị vô hiệu hoá | | |
| TC-11 | BVA (đúng biên) | Máy B nhập mã phòng của máy A | mã 4 ký tự đúng | Máy B vào cùng phòng, máy A thấy B xuất hiện | | |
| TC-12 | BVA (trên biên) | Cố nhập ký tự thứ 5 | `AB2C3` | Ô nhập chỉ nhận 4 ký tự | | |
| TC-13 | EP | Nhập mã chữ thường của phòng có thật | `ab2c` | Vào phòng bình thường (không phân biệt hoa/thường) | | |
| TC-14 | EP (không hợp lệ) | Nhập mã 4 ký tự không tồn tại | `0000` | Báo "Room code not found…" | | |
| TC-15 | ST | Máy C nhập mã phòng đang chơi | mã phòng PLAYING | Báo "Match is already in progress…" | | |
| TC-16 | — | Tắt server → mở app | — | Nút Tạo phòng / Vào phòng bị vô hiệu hoá; chế độ Offline vẫn chơi được | | |

## 3. Số người chơi trong phòng

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-17 | BVA (1 người) | Host ở một mình | 1 người | Nút "Bắt đầu" bị vô hiệu hoá | | |
| TC-18 | BVA (2 người) | Thêm 1 người, người đó bấm Sẵn sàng | 2 người | Nút "Bắt đầu" bật được | | |
| TC-19 | BVA (4 người) | Thêm tới 4 người | 4 người | Cả 4 vào được, hiển thị 4/4 | | |
| TC-20 | BVA (5 người) | Máy thứ 5 nhập mã | 5 người | Máy 5 báo "This room is already full (4/4 climbers)" | | |
| TC-21 | ST | Host thoát khỏi phòng có 3 người | — | Một người còn lại tự động thành Host | | |
| TC-22 | ST | Người cuối cùng thoát | — | Phòng bị xoá; nhập lại mã đó báo "not found" | | |

## 4. Màu nhân vật & cài đặt trận

| ID | Kỹ thuật | Bước thực hiện | Dữ liệu | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|---|
| TC-23 | EP | 4 người vào phòng | — | Mỗi người một màu khác nhau | | |
| TC-24 | EP (không hợp lệ) | Máy B chọn màu máy A đang dùng | màu đã bị chiếm | Ô màu đó bị khoá, không chọn được | | |
| TC-25 | EP | Máy B chọn màu còn trống | màu trống | Đổi màu thành công, mọi máy cập nhật | | |
| TC-26 | EP | Khách (không phải Host) thử đổi cài đặt | — | Các nút cài đặt bị vô hiệu hoá | | |
| TC-27 | BVA | Host chọn lần lượt thời gian 60s và 300s | 60, 300 | Mọi máy thấy giá trị mới; trận kết thúc đúng thời gian đã chọn | | |
| TC-28 | EP | Host tắt "Băng" và "Đá rơi" → bắt đầu | Ice OFF, Boulders OFF | Trong trận không có bậc băng và đá rơi | | |

## 5. Bắt đầu trận – bảng quyết định

| Điều kiện / Luật | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| Người bấm là Host | N | Y | Y | Y |
| Số người ≥ 2 | – | N | Y | Y |
| Tất cả đã Sẵn sàng | – | – | N | Y |
| **Kết quả: bắt đầu đếm ngược** | Không (nút ẩn/khoá) | Không | Không | **Có** |

| ID | Luật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-29 | R1 | Khách nhìn màn hình phòng chờ | Không có nút Bắt đầu khả dụng | | |
| TC-30 | R2 | Host ở một mình | Nút Bắt đầu bị khoá | | |
| TC-31 | R3 | 2 người, khách chưa Sẵn sàng | Nút Bắt đầu bị khoá | | |
| TC-32 | R4 | 2 người, tất cả Sẵn sàng → Host bấm Bắt đầu | Mọi máy đếm 3-2-1 rồi vào trận cùng lúc | | |

## 6. Trong trận

| ID | Kỹ thuật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-33 | ST | Trong lúc đếm ngược, 1 khách thoát | Huỷ đếm ngược, phòng quay về trạng thái chờ | | |
| TC-34 | — | So sánh màn chơi giữa các máy trong cùng trận | Vị trí bậc, băng, đá rơi giống hệt nhau trên mọi máy | | |
| TC-35 | EP | Bấm đúng hướng mũi tên | Nhân vật leo lên 1 bậc (+10m) | | |
| TC-36 | EP (sai) | Bấm sai hướng | Hiện thông báo trượt, rơi xuống 2 bậc | | |
| TC-37 | — | Đứng yên trên bậc băng quá ~0.75s | Nhân vật trượt xuống 2 bậc | | |
| TC-38 | — | Bị đá rơi trúng | Nhân vật bị choáng, rơi xuống 3 bậc | | |
| TC-39 | — | Quan sát máy khác khi mình leo | Vị trí của mình cập nhật gần thời gian thực trên máy khác | | |
| TC-40 | ST | Một người lên tới đích, người khác chưa | Người đó hiện "đã về đích", những người khác vẫn chơi tiếp | | |
| TC-41 | ST | Tất cả lên tới đích | Trận kết thúc, chuyển sang màn hình kết quả | | |
| TC-42 | ST | Không ai về đích, chờ hết giờ | Trận kết thúc khi hết thời gian | | |

## 7. Kết quả & chơi lại

| ID | Kỹ thuật | Bước thực hiện | Kết quả mong đợi | Thực tế | KQ |
|---|---|---|---|---|---|
| TC-43 | — | Xem bảng xếp hạng | Người về đích xếp theo thời gian tăng dần, người chưa về xếp theo độ cao giảm dần | | |
| TC-44 | ST | Host bấm Chơi lại | Tất cả về phòng chờ, độ cao về 0, khách phải bấm Sẵn sàng lại | | |
| TC-45 | ST | Khách (không phải Host) bấm Chơi lại | Phòng không reset; khách nhận lỗi "Only the room Host can perform this action." | | |

---

## Tổng kết

| Nhóm | Số TC | Pass | Fail |
|---|---|---|---|
| 1. Nickname | 7 | | |
| 2. Tạo / vào phòng | 9 | | |
| 3. Số người chơi | 6 | | |
| 4. Màu & cài đặt | 6 | | |
| 5. Bắt đầu trận | 4 | | |
| 6. Trong trận | 10 | | |
| 7. Kết quả & chơi lại | 3 | | |
| **Tổng** | **45** | | |

> Kiểm thử hộp trắng (unit test) cho PRNG, bộ sinh màn chơi và logic phòng nằm ở `packages/shared/test` và `apps/server/test`, chạy bằng `npm test`.
