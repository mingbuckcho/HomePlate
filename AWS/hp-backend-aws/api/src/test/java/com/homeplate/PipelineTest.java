package com.homeplate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

public class PipelineTest {
    @Test
    @DisplayName("Jenkins CI 파이프라인 정상 작동 확인 테스트")
    void test() {
        String project = "HomePlate";
        String ci = "Jenkins";

        String result = project + " with " + ci;
        assertThat(result).isEqualTo("HomePlate with Jenkins");
        System.out.println("젠킨스 자동 빌드 및 테스트가 성공적으로 통과되었습니다!");
    }
}
