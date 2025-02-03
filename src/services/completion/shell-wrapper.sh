#!/bin/bash

# 禁用命令提示符和回显
PS1=""
TERM=dumb
stty -echo

# 函数：执行命令并返回 JSON 格式的结果
execute_command() {
    local id="$1"
    local cmd="$2"
    local output_file=$(mktemp)
    local error_file=$(mktemp)
    
    # 执行命令，捕获输出和错误
    eval "$cmd" > "$output_file" 2> "$error_file"
    local exit_code=$?
    
    # 读取输出和错误
    local stdout=$(cat "$output_file" | sed 's/"/\\"/g' | tr '\n' ' ')
    local stderr=$(cat "$error_file" | sed 's/"/\\"/g' | tr '\n' ' ')
    
    # 清理临时文件
    rm -f "$output_file" "$error_file"
    
    # 返回 JSON 格式的结果
    printf '{"id":"%s","exitCode":%d,"stdout":"%s","stderr":"%s"}\n' \
        "$id" "$exit_code" "$stdout" "$stderr"
}

# 主循环：读取和执行命令
while IFS= read -r line; do
    if [[ "$line" == \{* ]]; then
        # 解析 JSON 命令
        id=$(echo "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
        cmd=$(echo "$line" | sed -n 's/.*"command":"\([^"]*\)".*/\1/p')
        
        if [[ -n "$id" && -n "$cmd" ]]; then
            execute_command "$id" "$cmd"
        fi
    fi
done 