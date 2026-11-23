package com.travel.service;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.travel.common.*;
import com.travel.domain.*;
import com.travel.dto.Requests.AttractionWrite;
import com.travel.dto.ReadModels.AttractionFilter;
import com.travel.dto.ReadModels.AttractionRow;
import com.travel.mapper.*;
import com.travel.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AttractionService {
    private final AttractionMapper attractions;
    private final FavoriteMapper favorites;
    private final QueryMapper queries;
    private final ReadMapper reads;
    private final ObjectMapper json;
    private final WriteSupport writes;
    public Attraction find(Long id,boolean owner) {
        Attraction a = attractions.find(id);
        if (a == null || (owner && !a.getCreatedBy().equals(CurrentUser.id()))) throw BusinessException.missing();
        return a;
    }
    public ObjectNode view(Attraction a) {
        ObjectNode result = json.valueToTree(a);
        result.remove(List.of("favorited","favoriteId","favoriteCreatedAt"));
        result.put("isOwner",a.getCreatedBy().equals(CurrentUser.id()));
        result.put("isFavorited",a instanceof AttractionRow row ? row.isFavorited() : queries.favorited(CurrentUser.id(),a.getAttractionId()) > 0);
        return result;
    }
    public PageResult<ObjectNode> list(int page,int size,String keyword,String city,boolean onlyMine) {
        PageResult.validate(page,size);
        var filter = new AttractionFilter(CurrentUser.id(),keyword,city,onlyMine,false);
        var rows = reads.attractions(filter,(long)(page-1)*size,size);
        return new PageResult<>(rows.stream().map(this::view).toList(),reads.countAttractions(filter),page,size);
    }
    @Transactional public ObjectNode create(AttractionWrite dto) {
        Attraction a = new Attraction(); BeanUtils.copyProperties(dto,a); a.setCreatedBy(CurrentUser.id()); attractions.insert(a);
        return view(attractions.find(a.getAttractionId()));
    }
    @Transactional public ObjectNode patch(Long id,JsonNode patch) {
        Attraction a = find(id,true); BeanUtils.copyProperties(writes.patch(a,patch,AttractionWrite.class),a); attractions.update(a); return view(attractions.find(id));
    }
    @Transactional public Map<String,Boolean> delete(Long id) { find(id,true); attractions.delete(id); return Map.of("deleted",true); }
    public PageResult<ObjectNode> favorites(int page,int size,String keyword,String city) {
        PageResult.validate(page,size);
        var filter = new AttractionFilter(CurrentUser.id(),keyword,city,false,true);
        var rows = reads.attractions(filter,(long)(page-1)*size,size).stream().map(a -> {
            ObjectNode node = json.createObjectNode(); node.put("favoriteId",a.getFavoriteId().toString());
            node.set("createdAt",json.valueToTree(a.getFavoriteCreatedAt())); node.set("attraction",view(a)); return node;
        }).toList();
        return new PageResult<>(rows,reads.countAttractions(filter),page,size);
    }
    @Transactional public Map<String,String> favorite(Long id) {
        find(id,false); Favorite f = new Favorite(); f.setUserId(CurrentUser.id()); f.setAttractionId(id); favorites.insert(f);
        return Map.of("favoriteId",f.getFavoriteId().toString(),"attractionId",id.toString());
    }
    @Transactional public Map<String,Boolean> unfavorite(Long id) { return Map.of("deleted",queries.unfavorite(CurrentUser.id(),id)>0); }
}
