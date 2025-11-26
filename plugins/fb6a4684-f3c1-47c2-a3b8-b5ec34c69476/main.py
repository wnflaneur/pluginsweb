import re
import html

def run(input_data):
    """
    正则表达式测试插件核心逻辑
    :param input_data: 前端传入的字典，包含：
                       - regex: 正则表达式字符串
                       - test_string: 测试字符串
                       - flags: 正则表达式 flags（列表形式）
    :return: 处理结果字典（错误时返回 {"error": "消息"}，成功时返回约定格式）
    """
    try:
        # 1. 解析并验证输入数据
        regex = input_data.get('regex', '').strip()
        test_string = input_data.get('test_string', '')
        # 处理复选框数据（可能是单个值或列表）
        flags_input = input_data.get('flags', [])
        flags = flags_input if isinstance(flags_input, list) else [flags_input] if flags_input else []

        # 错误返回：验证输入
        if not regex:
            return {"error": "请输入正则表达式"}
        if not test_string and regex:
            return {"warning": "测试字符串为空，无法进行匹配测试", "status": "warning"}

        # 2. 解析 flags
        flag_dict = {
            'IGNORECASE': (re.IGNORECASE, 'i'),
            'MULTILINE': (re.MULTILINE, 'm'),
            'DOTALL': (re.DOTALL, 's'),
            'UNICODE': (re.UNICODE, 'u'),
            'VERBOSE': (re.VERBOSE, 'x')
        }

        # 过滤无效的 flags 并生成简短标识
        valid_flags = []
        flag_aliases = []
        flag_value = 0
        for flag in flags:
            if flag in flag_dict:
                valid_flags.append(flag)
                flag_value |= flag_dict[flag][0]
                flag_aliases.append(flag_dict[flag][1])

        # 3. 编译正则表达式（错误处理优化）
        try:
            pattern = re.compile(regex, flag_value)
        except re.error as e:
            error_pos = e.pos if hasattr(e, 'pos') else '未知位置'
            return {"error": f"正则表达式语法错误 (位置 {error_pos}): {str(e)}"}

        # 4. 执行匹配（增加全量匹配信息）
        match_results = []
        matches = pattern.finditer(test_string)
        
        for match in matches:
            # 提取分组信息
            groups_info = []
            for i, group in enumerate(match.groups()):
                groups_info.append({
                    'index': i + 1,  # 分组索引从1开始
                    'value': group,
                    'start': match.start(i + 1),
                    'end': match.end(i + 1)
                })

            # 提取命名分组
            named_groups = []
            for name, index in match.re.groupindex.items():
                named_groups.append({
                    'name': name,
                    'index': index,
                    'value': match.group(name),
                    'start': match.start(name),
                    'end': match.end(name)
                })

            match_info = {
                'match_number': len(match_results) + 1,
                'start': match.start(),
                'end': match.end(),
                'value': match.group(),
                'length': match.end() - match.start(),
                'groups': groups_info,
                'named_groups': named_groups
            }
            match_results.append(match_info)

        # 5. 生成结果
        total_matches = len(match_results)
        success_message = f"找到 {total_matches} 个匹配项" if total_matches > 0 else "未找到匹配项"

        # 6. 成功返回（增强结果数据）
        return {
            "status": "success",
            "message": success_message,
            "data": {
                "type": "regex_result",
                "total_matches": total_matches,
                "matches": match_results,
                "regex": regex,
                "regex_with_flags": f"{regex}{''.join(flag_aliases)}",  # 类似Perl风格的正则表示
                "test_string": test_string,
                "flags": valid_flags,
                "flag_aliases": flag_aliases
            }
        }

    # 捕获其他未知错误
    except Exception as e:
        return {"error": f"处理正则表达式时发生错误: {str(e)}"}

