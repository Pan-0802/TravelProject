"""Generate the initial eight SQL-aligned models and explicit MyBatis mappings."""
from pathlib import Path
import re

root = Path(__file__).parent
schema = (root.parent / 'ER图和Mysql/01_建库建表_MySQL8.sql').read_text(encoding='utf-8')
for table, body in re.findall(r'CREATE TABLE IF NOT EXISTS `(\w+)` \((.*?)\n\) ENGINE', schema, re.S):
    name = ''.join(s.title() for s in table.split('_'))
    columns = re.findall(r'^  `(\w+)` (\w+)', body, re.M)
    camel = lambda s: re.sub(r'_([a-z])', lambda m: m[1].upper(), s)
    types = {'BIGINT': 'Long', 'INT': 'Integer', 'SMALLINT': 'Integer', 'VARCHAR': 'String', 'TEXT': 'String', 'JSON': 'String', 'DECIMAL': 'BigDecimal', 'DATE': 'LocalDate', 'DATETIME': 'LocalDateTime', 'TIME': 'LocalTime'}
    fields = []
    for col, sqltype in columns:
        typ = types[sqltype]
        annotations = ''
        if typ == 'Long': annotations += '    @JsonSerialize(using = ToStringSerializer.class)\n'
        if typ == 'LocalTime': annotations += '    @JsonFormat(pattern = "HH:mm")\n'
        if col == 'password_hash': annotations += '    @JsonIgnore\n'
        fields.append(annotations + f'    private {typ} {camel(col)};')
    text = '''package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class NAME {
FIELDS
}
'''.replace('NAME', name).replace('FIELDS', '\n'.join(fields))
    path = root / f'src/main/java/com/travel/domain/{name}.java'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    pk = columns[0][0]
    writable = [col for col, _ in columns if col != pk and col not in ('created_at', 'updated_at')]
    mapper = f'''package com.travel.mapper;

import com.travel.domain.{name};
import org.apache.ibatis.annotations.Param;

public interface {name}Mapper {{
    {name} find(@Param("id") Long id);
    {name} lock(@Param("id") Long id);
    int insert({name} entity);
    int update({name} entity);
    int delete(@Param("id") Long id);
}}
'''
    path = root / f'src/main/java/com/travel/mapper/{name}Mapper.java'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(mapper, encoding='utf-8')
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "https://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.travel.mapper.{name}Mapper">
  <select id="find" resultType="com.travel.domain.{name}">SELECT * FROM `{table}` WHERE `{pk}` = #{{id}}</select>
  <select id="lock" resultType="com.travel.domain.{name}">SELECT * FROM `{table}` WHERE `{pk}` = #{{id}} FOR UPDATE</select>
  <insert id="insert" useGeneratedKeys="true" keyProperty="{camel(pk)}">
    INSERT INTO `{table}` ({', '.join('`'+c+'`' for c in writable)})
    VALUES ({', '.join('#{'+camel(c)+'}' for c in writable)})
  </insert>
  <update id="update">UPDATE `{table}` SET {', '.join('`'+c+'` = #{'+camel(c)+'}' for c in writable)} WHERE `{pk}` = #{{{camel(pk)}}}</update>
  <delete id="delete">DELETE FROM `{table}` WHERE `{pk}` = #{{id}}</delete>
</mapper>
'''
    path = root / f'src/main/resources/mapper/{name}Mapper.xml'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(xml, encoding='utf-8')
