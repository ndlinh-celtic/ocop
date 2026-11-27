<!-- Sinh bởi packages/core/test/policy-matrix.test.ts; đừng sửa tay. Cập nhật: pnpm --filter @ocop/core test -u -->

# Ma trận phân quyền

## Action không gắn tài nguyên

Khai báo ở `permissions.ts` của từng module, gộp ở `identity/policy.ts`. Phạm vi (DataScope) quyết định thêm là những bản ghi nào.

| Action | Chủ thể | Cán bộ xã | Cán bộ Sở | Chủ tịch hội đồng | Thư ký hội đồng | Thành viên hội đồng | Thành viên Tổ tư vấn | Quản trị |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `audit.search` |  |  |  |  |  |  |  | ✓ |
| `council.manage` |  |  | ✓ |  |  |  |  |  |
| `council.read` |  |  | ✓ |  |  |  |  | ✓ |
| `criteria.copy` |  |  |  |  |  |  |  | ✓ |
| `criteria.delete` |  |  |  |  |  |  |  | ✓ |
| `criteria.edit` |  |  |  |  |  |  |  | ✓ |
| `criteria.import` |  |  |  |  |  |  |  | ✓ |
| `criteria.preview` |  |  |  |  |  |  |  | ✓ |
| `criteria.publish` |  |  |  |  |  |  |  | ✓ |
| `criteria.read_draft` |  |  |  |  |  |  |  | ✓ |
| `delivery.list` |  |  |  |  |  |  |  | ✓ |
| `documents.template.manage` |  |  |  |  |  |  |  | ✓ |
| `dossier.advisory_report.draft` |  |  |  |  |  |  | ✓ |  |
| `dossier.advisory_report.read` |  |  |  | ✓ | ✓ | ✓ | ✓ |  |
| `dossier.advisory_report.upload` |  |  |  |  |  |  | ✓ |  |
| `dossier.advisory_report.write` |  |  |  |  |  |  | ✓ |  |
| `dossier.advisory_return_request.read` |  |  | ✓ |  |  |  | ✓ |  |
| `dossier.assignment.read` |  |  |  | ✓ | ✓ |  |  |  |
| `dossier.create` | ✓ |  |  |  |  |  |  |  |
| `dossier.create_on_behalf` |  | ✓ |  |  |  |  |  |  |
| `dossier.document.download` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `dossier.document.download_on_behalf` |  | ✓ |  |  |  |  |  |  |
| `dossier.evidence.upload` | ✓ |  |  |  |  |  |  |  |
| `dossier.evidence.upload_on_behalf` |  | ✓ |  |  |  |  |  |  |
| `dossier.export` |  | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `dossier.handler.list` |  | ✓ |  |  |  |  |  |  |
| `dossier.overview` |  |  | ✓ |  |  |  |  |  |
| `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `dossier.read_on_behalf` |  | ✓ |  |  |  |  |  |  |
| `dossier.return_request.read` |  | ✓ | ✓ |  |  |  |  |  |
| `dossier.ward_report.generate` |  | ✓ |  |  |  |  |  |  |
| `dossier.ward_report.upload` |  | ✓ |  |  |  |  |  |  |
| `dossier.write` | ✓ | ✓ | ✓ |  | ✓ |  |  |  |
| `dossier.write_on_behalf` |  | ✓ |  |  |  |  |  |  |
| `entity.create` |  | ✓ |  |  |  |  |  |  |
| `entity.legal_document.manage` | ✓ |  |  |  |  |  |  |  |
| `entity.personal_id.reveal` | ✓ | ✓ |  |  |  |  |  |  |
| `entity.read` | ✓ | ✓ | ✓ |  |  | ✓ |  |  |
| `entity.representative_email.change` |  | ✓ |  |  |  |  |  |  |
| `entity.update` | ✓ |  |  |  |  |  |  |  |
| `file.test_upload` |  |  |  |  |  |  |  | ✓ |
| `results.certificate.manage` |  |  | ✓ |  |  |  |  |  |
| `results.decision.record` |  |  | ✓ |  |  |  |  |  |
| `results.five_star.manage` |  |  | ✓ |  |  |  |  |  |
| `results.general_comment.write` |  |  |  | ✓ | ✓ |  |  |  |
| `results.package.export` |  |  | ✓ |  |  |  |  |  |
| `results.result_letter.download` | ✓ |  | ✓ |  |  |  |  |  |
| `results.result_letter.issue` |  |  | ✓ |  |  |  |  |  |
| `results.star_list.export` |  |  | ✓ |  |  |  |  |  |
| `role.grant` |  |  |  |  |  |  |  | ✓ |
| `role.revoke` |  |  |  |  |  |  |  | ✓ |
| `round.council.assign` |  |  | ✓ |  |  |  |  |  |
| `round.grading_mode.change` |  |  | ✓ |  | ✓ |  |  |  |
| `round.manage` |  |  | ✓ |  |  |  |  |  |
| `scoring.advisory_copy` |  |  |  |  |  |  | ✓ |  |
| `scoring.evidence.upload` |  |  |  |  |  | ✓ |  |  |
| `scoring.finalize` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.meeting.document` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.meeting.manage` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.meeting.minutes.upload` |  |  |  |  | ✓ |  |  |  |
| `scoring.progress.read` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.result.read` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.sheet.return` |  |  |  | ✓ | ✓ |  |  |  |
| `scoring.sheet.write` |  |  |  |  |  | ✓ |  |  |
| `scoring.unlock` |  |  |  |  |  |  |  | ✓ |
| `system.settings.manage` |  |  |  |  |  |  |  | ✓ |
| `user.create` |  |  |  |  |  |  |  | ✓ |
| `user.list` |  |  |  |  |  |  |  | ✓ |
| `user.resend_activation` |  |  |  |  |  |  |  | ✓ |

Mọi Người dùng đã đăng nhập, với dữ liệu của chính mình: `criteria.read_published`, `notification.read_own`, `password.change_own`, `reauth.own`, `role.switch_own`, `round.read`, `totp.enroll_own`.

## Action trên một hồ sơ

Bảng chuyển trạng thái `dossiers/transitions.ts`; Phạm vi của người dùng phải bao hồ sơ.

| Action | Từ | Đến | Vai trò | Ghi chú |
| --- | --- | --- | --- | --- |
| `dossier.advisory_copy` | Đã phát hành báo cáo Tổ tư vấn | Thành viên xem xét | Thành viên Tổ tư vấn |  |
| `dossier.advisory_copy` | Thành viên xác nhận | Thành viên xác nhận | Thành viên Tổ tư vấn |  |
| `dossier.advisory_copy` | Thành viên xem xét | Thành viên xem xét | Thành viên Tổ tư vấn |  |
| `dossier.advisory_report.edit` | Tổ tư vấn thẩm định | Tổ tư vấn thẩm định | Thành viên Tổ tư vấn | checkOnly |
| `dossier.advisory_report.issue` | Tổ tư vấn thẩm định | Đã phát hành báo cáo Tổ tư vấn | Thành viên Tổ tư vấn |  |
| `dossier.advisory_report.reissue` | Đã phát hành báo cáo Tổ tư vấn | Đã phát hành báo cáo Tổ tư vấn | Thành viên Tổ tư vấn |  |
| `dossier.advisory_report.reissue` | Thành viên xác nhận | Thành viên xác nhận | Thành viên Tổ tư vấn |  |
| `dossier.advisory_report.reissue` | Thành viên xem xét | Thành viên xem xét | Thành viên Tổ tư vấn |  |
| `dossier.advisory_return_request` | Đã phát hành báo cáo Tổ tư vấn | Đã phát hành báo cáo Tổ tư vấn | Thành viên Tổ tư vấn |  |
| `dossier.advisory_return_request` | Tổ tư vấn thẩm định | Tổ tư vấn thẩm định | Thành viên Tổ tư vấn |  |
| `dossier.assignment.edit` | Đã chuyển tỉnh | Đã chuyển tỉnh | Thư ký hội đồng |  |
| `dossier.assignment.replace` | Đã phát hành báo cáo Tổ tư vấn | Đã phát hành báo cáo Tổ tư vấn | Thư ký hội đồng |  |
| `dossier.assignment.replace` | Tổ tư vấn thẩm định | Tổ tư vấn thẩm định | Thư ký hội đồng |  |
| `dossier.assignment.replace` | Đã chuyển tỉnh | Đã chuyển tỉnh | Thư ký hội đồng |  |
| `dossier.assignment.replace` | Thành viên xác nhận | Thành viên xác nhận | Thư ký hội đồng |  |
| `dossier.assignment.replace` | Thành viên xem xét | Thành viên xem xét | Thư ký hội đồng |  |
| `dossier.checklist.assess` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.checklist.assess` | Yêu cầu bổ sung | Yêu cầu bổ sung | Cán bộ xã |  |
| `dossier.delete` | Nháp | Nháp | Chủ thể |  |
| `dossier.edit` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.edit` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.evidence.add` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.evidence.add` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.evidence.link` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.evidence.link` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.evidence.remove` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.evidence.remove` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.explain` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.explain` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.finalize` | Thành viên xác nhận | Đã chốt điểm | Chủ tịch hội đồng, Thư ký hội đồng |  |
| `dossier.five_star.close` | Đã gửi đề nghị 5 sao | Đã đóng, xử lý ngoài hệ thống | Cán bộ Sở |  |
| `dossier.five_star.mark_sent` | Đã chốt điểm | Đã gửi đề nghị 5 sao | Cán bộ Sở |  |
| `dossier.five_star.return_to_province` | Đã gửi đề nghị 5 sao | Đã gửi đề nghị 5 sao | Cán bộ Sở |  |
| `dossier.forward` | Đã nộp xã | Đã chuyển tỉnh | Cán bộ xã |  |
| `dossier.general_comment.edit` | Đã chốt điểm | Đã chốt điểm | Chủ tịch hội đồng, Thư ký hội đồng |  |
| `dossier.grading.start_advisory` | Đã chuyển tỉnh | Tổ tư vấn thẩm định | Thư ký hội đồng |  |
| `dossier.grading.start_direct` | Đã chuyển tỉnh | Thành viên xem xét | Thư ký hội đồng |  |
| `dossier.handler.change` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.handler.change` | Yêu cầu bổ sung | Yêu cầu bổ sung | Cán bộ xã |  |
| `dossier.province_receive` | Đã chuyển tỉnh | Đã chuyển tỉnh | Cán bộ Sở |  |
| `dossier.province_return` | Đã phát hành báo cáo Tổ tư vấn | Yêu cầu bổ sung | Cán bộ Sở |  |
| `dossier.province_return` | Tổ tư vấn thẩm định | Yêu cầu bổ sung | Cán bộ Sở |  |
| `dossier.province_return` | Đã chuyển tỉnh | Yêu cầu bổ sung | Cán bộ Sở |  |
| `dossier.receive` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.recognize` | Đã chốt điểm | Công nhận 3/4 sao | Cán bộ Sở |  |
| `dossier.recognize_supplementary` | Đã gửi đề nghị 5 sao | Công nhận 3/4 sao | Cán bộ Sở |  |
| `dossier.reject` | Đã nộp xã | Không đạt sơ bộ | Cán bộ xã |  |
| `dossier.resubmit` | Yêu cầu bổ sung | Đã nộp xã | Chủ thể | Nhập hộ |
| `dossier.result_letter.correct` | Không đạt | Không đạt | Cán bộ Sở |  |
| `dossier.result_letter.issue` | Đã chốt điểm | Không đạt | Cán bộ Sở |  |
| `dossier.result_publish` | Đã chốt điểm | Đã chốt điểm | Cán bộ Sở |  |
| `dossier.return_request` | Đã chuyển tỉnh | Đã chuyển tỉnh | Cán bộ xã |  |
| `dossier.round_transfer` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.score_sheet.confirm` | Thành viên xác nhận | Thành viên xác nhận | Thành viên hội đồng |  |
| `dossier.score_sheet.confirm` | Thành viên xem xét | Thành viên xem xét | Thành viên hội đồng |  |
| `dossier.score_sheet.confirm_ready` | Thành viên xem xét | Thành viên xác nhận | Thành viên hội đồng |  |
| `dossier.score_sheet.edit` | Thành viên xác nhận | Thành viên xác nhận | Thành viên hội đồng | checkOnly |
| `dossier.score_sheet.edit` | Thành viên xem xét | Thành viên xem xét | Thành viên hội đồng | checkOnly |
| `dossier.score_sheet.return` | Thành viên xác nhận | Thành viên xác nhận | Chủ tịch hội đồng, Thư ký hội đồng |  |
| `dossier.score_sheet.return` | Thành viên xem xét | Thành viên xem xét | Chủ tịch hội đồng, Thư ký hội đồng |  |
| `dossier.score_sheet.return_unready` | Thành viên xác nhận | Thành viên xem xét | Chủ tịch hội đồng, Thư ký hội đồng |  |
| `dossier.self_score` | Nháp | Nháp | Chủ thể | Nhập hộ |
| `dossier.self_score` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.submit` | Nháp | Đã nộp xã | Chủ thể | Nhập hộ |
| `dossier.supplement.close` | Yêu cầu bổ sung | Không đạt sơ bộ | Cán bộ xã |  |
| `dossier.supplement.request` | Đã nộp xã | Yêu cầu bổ sung | Cán bộ xã |  |
| `dossier.supplement.respond` | Yêu cầu bổ sung | Yêu cầu bổ sung | Chủ thể | Nhập hộ |
| `dossier.unlock` | Đã chốt điểm | Thành viên xác nhận | Quản trị | lookup |
| `dossier.ward_report.attach` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.ward_transfer` | Đã nộp xã | Đã nộp xã | Cán bộ xã |  |
| `dossier.withdraw` | Đã nộp xã | Đã rút | Chủ thể |  |
