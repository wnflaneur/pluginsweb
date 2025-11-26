import base64
import io
from PIL import Image, ImageSequence, ImageFilter

def run(input_data):
    """
    图片转换插件核心逻辑
    :param input_data: 前端传入的字典，包含：
                       - image_base64: 原始图片的Base64编码字符串
                       - target_width: 目标宽度 (字符串形式)
                       - target_height: 目标高度 (字符串形式)
                       - output_format: 输出格式 (PNG/JPG)
                       - sharpen_intensity: 锐化强度 (字符串形式)
    :return: 处理结果字典（错误时返回 {"error": "消息"}，成功时返回约定格式）
    """
    try:
        # 1. 解析并验证输入数据
        image_base64 = input_data.get('image_base64')
        print(input_data)
        # 错误返回：未选择图片（仅含 error 字段）
        if not image_base64:
            return {"error": "请先选择一张图片。"}

        # 解析并转换目标尺寸（错误返回仅含 error 字段）
        try:
            target_width = int(input_data.get('target_width', '256'))
            target_height = int(input_data.get('target_height', '256'))
        except ValueError:
            return {"error": "目标宽度和高度必须是有效的整数。"}

        # 解析输出格式
        output_format = input_data.get('output_format', 'PNG').upper()
        if output_format not in ['PNG', 'JPG']:
            output_format = 'PNG'  # 默认使用PNG

        # 解析并转换锐化强度（错误返回仅含 error 字段）
        try:
            sharpen_intensity = float(input_data.get('sharpen_intensity', '1.0'))
        except ValueError:
            return {"error": "锐化强度必须是有效的数字（如 1.0、2.5）。"}

        # 2. 解码Base64图片数据（错误返回仅含 error 字段）
        try:
            # 处理带前缀的Base64（如 data:image/png;base64,xxx）
            if ',' in image_base64:
                header, encoded = image_base64.split(',', 1)
            else:
                encoded = image_base64
            image_data = base64.b64decode(encoded)
            image_stream = io.BytesIO(image_data)
        except Exception:
            return {"error": "无效的图片数据，请上传正确的图片（如PNG、JPG、GIF）。"}

        # 3. 打开图片并选择最佳帧（处理ICO、GIF等多帧图片）
        with Image.open(image_stream) as img:
            # 提取所有帧
            frames = [f.copy() for f in ImageSequence.Iterator(img)]
            if not frames:
                best_frame = img.copy()
            else:
                # 过滤有效帧（排除尺寸为0的异常帧）
                valid_frames = [f for f in frames if f.size[0] > 0 and f.size[1] > 0]
                if not valid_frames:
                    return {"error": "图片文件中没有找到有效的图像帧（可能是损坏的GIF/ICO文件）。"}
                # 选择尺寸最大的帧（面积 = 宽 × 高）
                best_frame = max(valid_frames, key=lambda f: (f.size[0] * f.size[1]))

            # 转换为RGBA格式（统一处理透明通道）
            working_image = best_frame.convert("RGBA", dither=Image.Dither.NONE)

        # 4. 验证目标尺寸（错误返回仅含 error 字段）
        if target_width <= 0 or target_height <= 0:
            return {"error": "目标尺寸必须是大于0的整数。"}

        # 计算放大倍数（给出警告）
        orig_w, orig_h = working_image.size
        max_scale = max(target_width / orig_w, target_height / orig_h)
        warning = ""
        if max_scale > 6.0:
            warning = "警告：当前放大倍数超过6倍，可能导致图片严重模糊。"

        # 5. 执行缩放（使用LANCZOS算法保持高清）
        resample_filter = Image.Resampling.LANCZOS if hasattr(Image.Resampling, 'LANCZOS') else 1
        resized_img = working_image.resize((target_width, target_height), resample=resample_filter)

        # 6. 执行锐化（根据强度调整）
        if sharpen_intensity > 0:
            # UnsharpMask参数：radius（锐化半径）、percent（锐化百分比）、threshold（阈值）
            resized_img = resized_img.filter(ImageFilter.UnsharpMask(
                radius=1.5,
                percent=int(100 * sharpen_intensity),  # percent需为整数
                threshold=2
            ))

        # 7. 处理输出格式和透明通道
        output_stream = io.BytesIO()
        if output_format == 'JPG':
            # JPG不支持透明，创建白色背景
            background = Image.new(resized_img.mode[:-1], resized_img.size, (255, 255, 255))
            # 粘贴带透明通道的图像（mask参数使用Alpha通道）
            background.paste(resized_img, mask=resized_img.split()[-1])
            # 保存JPG（质量95，平衡清晰度和文件大小）
            background.save(output_stream, format='JPEG', quality=95)
        else:  # PNG（支持透明）
            # 保存PNG（优化压缩，减少文件大小）
            resized_img.save(output_stream, format='PNG', optimize=True)

        # 8. 将处理后的图片编码为Base64（带完整前缀）
        output_stream.seek(0)
        output_base64 = base64.b64encode(output_stream.getvalue()).decode('utf-8')
        data_url = f"data:image/{output_format.lower()};base64,{output_base64}"

        # 9. 成功返回（符合约定格式：status、message、data）
        return {
            "status": "success",
            "message": f"图片已成功转换为 {target_width}x{target_height} 的 {output_format} 格式。{warning}",
            "data": {
                "type": "image",  # 与plugin.json的output.type一致
                "content": data_url,  # 完整的Base64数据URL（前端用于预览和下载）
                "meta": {
                    "filename": f"converted_{target_width}x{target_height}.{output_format.lower()}",  # 下载文件名
                    "width": target_width,
                    "height": target_height
                }
            }
        }

    # 捕获其他未知错误（如Pillow版本兼容、图片损坏等）
    except Exception as e:
        return {"error": f"处理图片时发生未知错误：{str(e)}"}

